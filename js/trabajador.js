/* ============================================================
   Worker de Agios: análisis, guardado incremental, embeddings por
   lotes (reanudables) y búsqueda. Todo ocurre en el dispositivo:
   lo único que se descarga de internet es la librería y el modelo.
   ============================================================ */
import * as db from './db.js';
import { cargarAnalizador } from './analizadores/index.js';
import { MODELO, FRAGMENTOS, LOTE, URL_TRANSFORMERS } from './config.js';
import { fragmentar, hashPieza } from './motor/fragmentos.js';
import * as B from './motor/buscador.js';

const avisar = m => self.postMessage(m);

/* ---------- Modelo (transformers.js) ---------- */
let extractor = null, cargando = null;
let cola = Promise.resolve();               // una sola inferencia a la vez
const enCola = fn => (cola = cola.then(fn, fn));

function cargarModelo() {
  if (extractor) return Promise.resolve(extractor);
  cargando ??= (async () => {
    const { pipeline, env } = await import(URL_TRANSFORMERS);
    env.allowLocalModels = false;
    env.useBrowserCache = true;              // queda en caché: funciona sin internet
    try { env.backends.onnx.wasm.numThreads = 1; } catch {}
    const archivos = new Map();
    let ultimo = 0;
    extractor = await pipeline('feature-extraction', MODELO.id, {
      dtype: MODELO.dtype,
      device: 'wasm',
      progress_callback: p => {
        if (p.status !== 'progress' || !p.total) return;
        archivos.set(p.file, [p.loaded, p.total]);
        let l = 0, t = 0;
        for (const [a, b] of archivos.values()) { l += a; t += b; }
        const ahora = Date.now();
        if (ahora - ultimo > 250 || l === t) { ultimo = ahora; avisar({ tipo: 'modelo', pct: l / t, mb: t / 1e6 }); }
      },
    });
    return extractor;
  })().catch(e => { cargando = null; throw e; });
  return cargando;
}

async function vectores(textos) {
  const ex = await cargarModelo();
  return enCola(async () => {
    const t = await ex(textos, { pooling: 'mean', normalize: true });
    return t.data;                           // Float32Array (n × dimensiones)
  });
}

/* ---------- Datos en memoria para buscar ---------- */
const cache = new Map();                     // coleccion → datos preparados
async function datosDe(coleccion, A) {
  if (cache.has(coleccion)) return cache.get(coleccion);
  const [piezas, frags] = await Promise.all([
    db.todos('piezas', 'coleccion', coleccion),
    db.todos('fragmentos', 'coleccion', coleccion),
  ]);
  piezas.sort((a, b) => a.orden - b.orden);
  const d = B.prepararDatos(piezas, frags, A.esMarca, MODELO.dimensiones);
  cache.set(coleccion, d);
  return d;
}

/* ---------- Procesar un documento ---------- */
async function procesar({ coleccion, analizador, documento, parrafos }) {
  const A = await cargarAnalizador(analizador);
  avisar({ tipo: 'progreso', fase: 'analizando', texto: 'analizando estructura…' });
  const { piezas, informe } = A.analizar(parrafos);
  if (!informe.ok) {
    await db.borrar('trabajos', coleccion);
    avisar({ tipo: 'sin-estructura', informe });
    return;
  }

  // Hash por pieza para no repetir trabajo con una versión nueva del documento
  for (let i = 0; i < piezas.length; i++) {
    const p = piezas[i];
    p.id = `${coleccion}|${p.clave}`;
    p.coleccion = coleccion;
    p.orden = i;
    p.hash = await hashPieza(p);
  }
  const [previas, colPrevia, clavesFrag] = await Promise.all([
    db.todos('piezas', 'coleccion', coleccion),
    db.obtener('colecciones', coleccion),
    db.clavesPorIndice('fragmentos', 'coleccion', coleccion),
  ]);
  const hashPrevio = new Map(previas.map(p => [p.id, p.hash]));
  const cambioDeModelo = !!colPrevia && colPrevia.modelo !== MODELO.id;
  const act = { nuevas: 0, modificadas: 0, sinCambios: 0, eliminadas: 0 };
  const rehacer = new Set();
  for (const p of piezas) {
    const h = hashPrevio.get(p.id);
    if (h === undefined) { act.nuevas++; rehacer.add(p.id); }
    else if (h !== p.hash) { act.modificadas++; rehacer.add(p.id); }
    else { act.sinCambios++; if (cambioDeModelo) rehacer.add(p.id); }
  }
  const vigentes = new Set(piezas.map(p => p.id));
  const eliminadas = previas.filter(p => !vigentes.has(p.id)).map(p => p.id);
  act.eliminadas = eliminadas.length;
  const piezaDeFrag = k => k.slice(0, k.lastIndexOf('#'));
  const fragsABorrar = clavesFrag.filter(k => rehacer.has(piezaDeFrag(k)) || !vigentes.has(piezaDeFrag(k)));

  const nuevos = [];
  for (const p of piezas) {
    if (!rehacer.has(p.id)) continue;
    for (const f of fragmentar(p, A.esMarca, FRAGMENTOS))
      nuevos.push({ id: `${p.id}#${f.posicion}`, coleccion, pieza: p.id, tipo: p.tipo, numero: p.numero, ...f, pend: coleccion });
  }

  const infoFinal = { ...informe, actualizacion: colPrevia ? act : null };
  await db.escribir(['colecciones', 'piezas', 'fragmentos', 'trabajos'], s => {
    eliminadas.forEach(k => s.piezas.delete(k));
    fragsABorrar.forEach(k => s.fragmentos.delete(k));
    piezas.forEach(p => s.piezas.put(p));
    nuevos.forEach(f => s.fragmentos.put(f));
    s.colecciones.put({
      id: coleccion, documento, informe: infoFinal, modelo: MODELO.id,
      estado: 'indexando', actualizado: Date.now(),
    });
    s.trabajos.delete(coleccion);           // ya no hace falta el archivo original
  });
  cache.delete(coleccion);
  avisar({ tipo: 'estructura', informe: infoFinal, aIndexar: rehacer.size });
  await indexar(coleccion);
}

/* ---------- Embeddings por lotes (reanudable) ---------- */
let indexando = null;
function indexar(coleccion) {
  indexando ??= indexarAhora(coleccion).finally(() => { indexando = null; });
  return indexando;
}
async function indexarAhora(coleccion) {
  const [pend, totalFrags, piezas] = await Promise.all([
    db.todos('fragmentos', 'pend', coleccion),
    db.contar('fragmentos', 'coleccion', coleccion),
    db.todos('piezas', 'coleccion', coleccion),
  ]);
  const contables = new Set(piezas.filter(p => p.tipo !== 'introduccion').map(p => p.id));
  const restantes = new Map();                 // pieza → fragmentos que le faltan
  for (const f of pend) restantes.set(f.pieza, (restantes.get(f.pieza) || 0) + 1);
  const totalPiezas = contables.size;
  let hechas = totalPiezas - [...restantes.keys()].filter(k => contables.has(k)).length;
  let faltan = pend.length;
  const progreso = () => avisar({
    tipo: 'progreso', fase: 'indexando',
    pct: totalFrags ? (totalFrags - faltan) / totalFrags : 1, hechas, total: totalPiezas,
  });
  progreso();

  if (pend.length) {
    try { await cargarModelo(); }
    catch (e) {
      await marcar(coleccion, 'sin-modelo');
      avisar({ tipo: 'listo', semantica: 'pendiente', motivo: String(e?.message || e) });
      return;
    }
    for (let i = 0; i < pend.length; i += LOTE) {
      const lote = pend.slice(i, i + LOTE);
      const v = await vectores(lote.map(f => MODELO.prefijoPasaje + f.texto));
      const d = MODELO.dimensiones;
      await db.escribir(['fragmentos'], s => lote.forEach((f, j) => {
        f.vector = v.slice(j * d, (j + 1) * d);
        f.modelo = MODELO.id;
        delete f.pend;
        s.fragmentos.put(f);
      }));
      for (const f of lote) {
        const r = restantes.get(f.pieza) - 1;
        restantes.set(f.pieza, r);
        if (r === 0 && contables.has(f.pieza)) hechas++;
      }
      faltan -= lote.length;
      progreso();
    }
  }
  await marcar(coleccion, 'listo');
  cache.delete(coleccion);
  avisar({ tipo: 'listo', semantica: 'ok' });
}

async function marcar(coleccion, estado) {
  const c = await db.obtener('colecciones', coleccion);
  if (c) { c.estado = estado; await db.guardar('colecciones', c); }
}

/* ---------- Buscar ---------- */
async function buscar({ id, coleccion, analizador, consulta }) {
  const A = await cargarAnalizador(analizador);
  const datos = await datosDe(coleccion, A);
  const salida = r => {
    const p = datos.porId.get(r.pieza);
    const corto = B.recortar(r.pasaje.texto, r.pasaje.intervalos || []);
    return {
      pieza: r.pieza, tipoPieza: p.tipo, numero: p.numero, ...A.etiqueta(p), origen: r.origen,
      extracto: corto,
      pasaje: { parrafoIni: r.pasaje.parrafoIni, parrafoFin: r.pasaje.parrafoFin, intervalos: r.pasaje.intervalos, desde: r.pasaje.desde },
    };
  };

  if (!datos.piezas.length) return avisar({ tipo: 'resultados', id, resultados: [], aviso: 'Todavía no hay documento: súbelo con 📎.' });

  // 1. Referencias: van directo a la pieza
  const ref = A.parsearReferencia(consulta);
  if (ref) {
    const reales = datos.piezas.filter(p => !p.repetida);
    let elegidas = [];
    if (ref.tipo === 'introduccion') elegidas = reales.filter(p => p.tipo === 'introduccion');
    else {
      const porTipo = (a, b) => (A.TIPOS[a.tipo]?.orden ?? 0) - (A.TIPOS[b.tipo]?.orden ?? 0);
      const grupo = g => reales.filter(q => q.grupo === g && q.tipo !== 'introduccion').sort(porTipo);
      if (ref.tipo === 'conjunto') elegidas = grupo(ref.numero);
      else {
        const p = reales.find(q => q.tipo === ref.tipo && q.numero === ref.numero);
        if (p) elegidas = [p, ...grupo(p.grupo).filter(q => q !== p)];
      }
    }
    if (!elegidas.length) {
      const nombre = ref.tipo === 'conjunto' ? `el conjunto ${ref.numero}` : `${A.TIPOS[ref.tipo]?.abrev || ''} ${ref.numero}`;
      return avisar({ tipo: 'resultados', id, resultados: [], referencia: true, aviso: `No existe ${nombre} en tu documento.` });
    }
    const resultados = elegidas.slice(0, 5).map((p, i) => {
      const idx = Math.max(0, p.parrafos.findIndex(t => !A.esMarca(t)));
      return salida({ pieza: p.id, origen: i === 0 && ref.tipo !== 'conjunto' ? 'referencia' : 'mismo conjunto', pasaje: { parrafoIni: idx, parrafoFin: idx, texto: p.parrafos[idx] || '', intervalos: [] } });
    });
    return avisar({ tipo: 'resultados', id, resultados, referencia: true });
  }

  // 2. Exacta + 3. por significado
  const exacta = B.buscarExacta(datos, consulta);
  let sem = [], aviso = null, qv = null;
  if (datos.fragmentos.length) {
    try {
      qv = (await vectores([MODELO.prefijoConsulta + consulta])).slice(0, MODELO.dimensiones);
      sem = B.buscarSignificado(datos, qv, 40);
      if (datos.pendientes) aviso = `El índice por significado va en ${Math.round(100 * datos.fragmentos.length / datos.totalFragmentos)}%.`;
    } catch (e) {
      aviso = 'La búsqueda por significado no está disponible (no se pudo cargar el modelo). Se muestran solo coincidencias exactas.';
    }
  } else if (datos.totalFragmentos) {
    aviso = 'La búsqueda por significado todavía no está lista: se muestran solo coincidencias exactas.';
  }
  const res = B.fusionar(datos, exacta, sem, { minimo: 2, maximo: 5 });

  // Para lo hallado solo por significado sin palabras en común,
  // se resalta la frase del pasaje más cercana a la consulta.
  if (qv) for (const r of res) {
    if (!r.necesitaFrase || r.pasaje.intervalos.length) continue;
    const frases = B.frasesDe(r.pasaje.texto).slice(0, 10);
    if (frases.length < 2) continue;
    try {
      const v = await vectores(frases.map(f => MODELO.prefijoPasaje + f.texto));
      let mejor = 0, mp = -Infinity;
      frases.forEach((f, i) => {
        let s = 0; for (let j = 0; j < MODELO.dimensiones; j++) s += v[i * MODELO.dimensiones + j] * qv[j];
        if (s > mp) { mp = s; mejor = i; }
      });
      r.pasaje.intervalos = [[frases[mejor].ini, frases[mejor].fin]];
    } catch {}
  }
  avisar({ tipo: 'resultados', id, resultados: res.map(salida), aviso });
}

/* ---------- Mensajes ---------- */
self.onmessage = async ({ data: m }) => {
  try {
    if (m.tipo === 'procesar') await procesar(m);
    else if (m.tipo === 'reanudar') await indexar(m.coleccion);
    else if (m.tipo === 'buscar') await buscar(m);
    else if (m.tipo === 'precargar') await cargarModelo().catch(() => {});
    else if (m.tipo === 'invalidar') cache.delete(m.coleccion);
  } catch (e) {
    console.error(e);
    avisar({ tipo: m.tipo === 'buscar' ? 'resultados' : 'error', id: m.id, resultados: [], mensaje: String(e?.message || e), aviso: 'Error al buscar: ' + (e?.message || e) });
  }
};
avisar({ tipo: 'listo-worker' });
