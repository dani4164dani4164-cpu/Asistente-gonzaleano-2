/* ============================================================
   Anesthios — página principal.
   Varios asistentes (uno por colección del registro), cada uno con
   su escena 3D, su tema, sus ventanas y sus datos:
     - menú de inicio: la nebulosa con un orbe por asistente; entrar
       es un nacimiento estelar y volver deshace al asistente en polvo
     - selector AGIOS | KYRIEN con transición (Implosión o Estallido)
     - máquina de estados del asistente activo, subida y procesamiento,
       búsqueda, ventanas, paneles, lector y menú ☰ (con Ajustes)
   Los datos guardados (IndexedDB «agios») NO cambian de forma: cada
   colección guarda los suyos con su id y nada de esto los toca.
   ============================================================ */
import * as THREE from 'three';
import { COLECCIONES, coleccion } from './colecciones.js';
import { ESCENAS } from './escenas/index.js';
import { crearTransicion } from './escenas/transicion.js';
import { crearNebulosa } from './escenas/nebulosa.js';
import { cargarAnalizador } from './analizadores/index.js';
import { leerDocx } from './docx.js';
import * as db from './db.js';
import { crearLector } from './lector.js';
import { crearVentanas } from './ventanas.js';
import { crearTablero } from './tablero.js';
import { tema as temaDe } from './temas.js';
import { abrirHoja, cerrarHoja, hojaAbierta, htmlEstructura, htmlMenu, htmlAjustes, leerAjuste, guardarAjuste } from './paneles.js';

const $ = id => document.getElementById(id);
const stage = $('stage'), zona = $('zona');
const suave = x => x * x * (3 - 2 * x), lim = x => Math.max(0, Math.min(1, x));
const hacia = (a, b, dT, k) => a + (b - a) * (1 - Math.pow(k, dT / 16.7));
const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

/* Sin WebGL 2: menú estático y cambios con fundido simple */
const WEBGL2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
document.documentElement.classList.toggle('sin-webgl', !WEBGL2);

/* ---------- Decoración de Kyrien: numerales romanos y filigranas ---------- */
$('numerales').innerHTML = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].map((r, i) =>
  `<span style="transform:translate(-50%,-50%) rotate(${i * 30}deg) translateY(-47.5%) translateY(calc(-1 * min(44vw,44vh,310px)))">${r}</span>`).join('');
const FILIGRANA = '<svg viewBox="0 0 46 46" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 44V14Q2 2 14 2H44"/><path d="M8 44V18Q8 8 18 8H44" opacity=".5"/><path d="M14 14l4-4 4 4-4 4z" fill="currentColor"/><circle cx="2" cy="44" r="1.6" fill="currentColor"/><circle cx="44" cy="2" r="1.6" fill="currentColor"/></svg>';
document.querySelectorAll('.filigrana').forEach(f => { f.innerHTML = FILIGRANA; });

/* ---------- Un asistente por colección ---------- */
const nuevoS = () => ({ energy: 0, mult: 1, apertura: 0, temblor: 0, destello: { color: new THREE.Color(), k: 0, h: 0 },
  particles: 90, rot: 0, rotVel: 0, tilt: 0, zoom: 1, T: 0 });
const AST = {};
const MODS = {};
const idLecturas = COLECCIONES.find(c => c.analizador === 'lecturas')?.id;
const tablero = crearTablero();
const enlazar = (html, colId) => enlazarCitas(html, colId);

for (const col of COLECCIONES) {
  const A = await cargarAnalizador(col.analizador);
  MODS[col.escena] ??= (await ESCENAS[col.escena]()).default;
  const tm = col.tema || 'agios';
  const a = { id: col.id, col, A, tema: tm, T: temaDe(tm), S: nuevoS(), escena: null, piezas: [], dibujos: 0 };
  a.capa = Object.assign(document.createElement('div'), { className: 'capa' });
  a.capa.style.opacity = 0; a.capa.dataset.col = col.id;
  stage.append(a.capa);
  a.titulo = document.createElement('div');
  a.titulo.className = `titulo-col t-${tm} apagado fuera`;
  a.titulo.innerHTML = `<h2></h2><div class="sub"></div>`;
  a.titulo.querySelector('h2').textContent = (col.asistente || col.nombre).toUpperCase();
  a.titulo.querySelector('.sub').textContent = tm === 'kyrien' ? (col.subtitulo || col.nombre) : (col.subtitulo || col.nombre).toUpperCase();
  $('titulos').append(a.titulo);
  a.cont = Object.assign(document.createElement('div'), { className: 'resultados-col', hidden: true });
  a.cont.dataset.col = col.id;
  $('resultados').append(a.cont);
  a.boton = Object.assign(document.createElement('button'), { type: 'button', textContent: (col.asistente || col.nombre).toUpperCase() });
  a.boton.dataset.col = col.id; a.boton.setAttribute('role', 'tab');
  a.boton.onclick = () => cambiar(col.id);
  $('selector').append(a.boton);
  a.orbe = document.createElement('button');
  a.orbe.type = 'button'; a.orbe.className = `orbe t-${tm}`; a.orbe.dataset.col = col.id;
  a.orbe.innerHTML = '<span class="bola"></span><b></b><small></small>';
  a.orbe.querySelector('b').textContent = (col.asistente || col.nombre).toUpperCase();
  a.orbe.querySelector('small').textContent = col.subtitulo || col.nombre;
  a.orbe.onclick = () => entrar(col.id);
  $('orbes').append(a.orbe);
  a.ventanas = crearVentanas({
    zona, cont: a.cont, escena: () => escenaDe(col.id), S: a.S, tema: tm, enlazar,
    alVerCompleto: r => lector.abrir(r.pieza, r.pasaje, r.col || col.id),
    alCambiar: lista => { if (activa === col.id) { tablero.abiertas(lista); $('cerrarTodas').classList.toggle('ver', lista.length > 1); } },
    alEnlace: el => alEnlace(el),
  });
  AST[col.id] = a;
}

/* La escena 3D de un asistente se crea la primera vez que se necesita */
function escenaDe(id) {
  const a = AST[id];
  if (!a.escena) {
    try {
      if (!WEBGL2) throw new Error('sin WebGL 2');
      a.escena = MODS[a.col.escena].crear(a.capa, a.S);
    } catch (e) {
      const centro = () => ({ x: zona.clientWidth / 2, y: zona.clientHeight * 0.52 });
      a.escena = { redimensionar() {}, dibujar() {}, destruir() {}, proyectar: centro, puntoDeAnillo: centro };
    }
    layout();
  }
  return a.escena;
}

/* ---------- Transición y nebulosa (se crean al usarlas) ---------- */
let trans = null, neb = null;
function asegurarTrans() { if (!trans && WEBGL2) { trans = crearTransicion(stage); layout(); } return trans; }
function asegurarNeb() { if (!neb && WEBGL2) { neb = crearNebulosa($('cielo')); layout(); } return neb; }
function layout() {
  const r = stage.getBoundingClientRect();
  if (r.width && r.height) {
    for (const id in AST) AST[id].escena?.redimensionar(r.width, r.height);
    trans?.redimensionar(r.width, r.height);
  }
  if (neb) { neb.redimensionar(innerWidth, innerHeight); if (r.width) neb.encuadre(r); }
  layoutOrbes();
}
addEventListener('resize', layout);
new ResizeObserver(layout).observe(stage);

/* Los orbes se acomodan para no encimarse (vertical u horizontal) */
function layoutOrbes() {
  const cont = $('orbes'), W = cont.clientWidth, H = cont.clientHeight;
  const lista = [...cont.children], n = lista.length;
  const horiz = W > H * 1.15;
  lista.forEach((o, i) => {
    const f = (i + 0.5) / n, alt = n === 1 ? 0 : (i % 2 ? 1 : -1);
    if (horiz) { o.style.left = (6 + 88 * f) + '%'; o.style.top = (50 + alt * 13) + '%'; }
    else { o.style.top = (4 + 92 * f) + '%'; o.style.left = (50 + alt * 18) + '%'; }
  });
}

/* ---------- Estado global ---------- */
let activa = null;              // id de la colección del asistente activo
let enMenu = document.body.classList.contains('tema-menu');
let viaje = null;               // {tipo:'entrar'|'volver', col, cambioTema, t, dur}
let cambio = null;              // transición entre asistentes
let modo = 'apagado';
let progreso = 0;               // avance del procesamiento (0..1)
let procCol = null;             // colección que se está procesando
let nebDibujos = 0;
let actualizacionPendiente = false;
const meta = { energy: 0, mult: 1, apertura: 0, temblor: 0 };
const ast = () => AST[activa];
const ponerTema = t => { document.body.className = 'tema-' + t; };
const ocupado = () => !!cambio || !!viaje || ['procesando', 'buscando', 'esperando'].includes(modo);

/* ---------- Datos de cada colección ---------- */
async function cargarPiezas(id) {
  AST[id].piezas = (await db.todos('piezas', 'coleccion', id)).sort((a, b) => a.orden - b.orden);
}
const hayDocumento = (id = activa) => AST[id]?.piezas.length > 0;
const lector = crearLector({
  datos: id => ({ A: AST[id].A, piezas: AST[id].piezas, tema: AST[id].tema }),
  activa: () => activa, enlazar, alEnlace: el => alEnlace(el),
});

/* Paneles con los datos YA guardados de la colección */
async function refrescarTablero(id = activa) {
  if (!id) return;
  const a = AST[id];
  const [reg, pend, total] = await Promise.all([
    db.obtener('colecciones', id), db.contar('fragmentos', 'pend', id), db.contar('fragmentos', 'coleccion', id),
  ]);
  if (id !== activa && !(cambio && cambio.a === id) && !(viaje && viaje.col === id)) return;
  const panel = a.A.PANEL || { etiqueta: 'Conjuntos', campo: 'conjuntos' };
  tablero.coleccion({ etiqueta: panel.etiqueta, conjuntos: reg?.informe?.datos?.[panel.campo] ?? null, fecha: reg?.actualizado ?? reg?.documento?.fecha ?? null });
  const pct = Math.floor(100 * (total - pend) / (total || 1));
  tablero.indice(!reg ? 'sin documento' : !pend ? '● listo' : reg.estado === 'sin-modelo' ? `pendiente ${pct}%` : `indexando ${pct}%`);
}
/* Lo que se ve de un asistente: panel, consola, textos (al entrar o a la mitad de un cambio) */
function mostrarUI(id) {
  const a = AST[id];
  $('subirTexto').textContent = `Elige el .docx de ${a.col.nombre}`;
  document.querySelectorAll('#selector button').forEach(b => {
    b.classList.toggle('on', b.dataset.col === id); b.setAttribute('aria-selected', b.dataset.col === id);
  });
  for (const k in AST) AST[k].titulo.classList.toggle('fuera', k !== id);
  pintarSugerencias(id);
  const lista = [...a.cont.querySelectorAll('.tarjeta:not(.cerrando)')].map(t => ({ pieza: t.dataset.pieza, corta: t.dataset.corta }));
  tablero.abiertas(lista); $('cerrarTodas').classList.toggle('ver', lista.length > 1);
  refrescarTablero(id);
}

/* ---------- Worker ---------- */
const worker = new Worker(new URL('./trabajador.js', import.meta.url), { type: 'module' });
const esperando = new Map();
let idBusqueda = 0;
let contexto = null;            // 'nuevo' | 'reanudar'
let ultimoInforme = null;
worker.onmessage = ({ data: m }) => {
  switch (m.tipo) {
    case 'progreso':
      if (modo !== 'procesando') break;
      if (m.fase === 'indexando') {
        progreso = contexto === 'reanudar' ? m.pct : 0.15 + 0.85 * m.pct;
        etiqueta(`${ast().T.estados.procesando.replace('…', '')} ${Math.floor(100 * m.pct)}% · ${m.hechas}/${m.total} piezas`);
        tablero.indice(`indexando ${Math.floor(100 * m.pct)}%`);
        const h = $('hint').textContent;
        if (m.pct < 1 && (!h || h.startsWith('Preparando') || h.startsWith('Estructura'))) pista('Creando el índice para buscar por significado. Con un documento grande puede tardar varios minutos; si se interrumpe, continuará donde se quedó.');
      } else { progreso = Math.max(progreso, 0.12); etiqueta(m.texto || 'procesando…'); }
      break;
    case 'modelo':
      if (modo === 'procesando') pista(m.pct < 1
        ? `Descargando el modelo de búsqueda: ${Math.floor(100 * m.pct)}% de ${Math.round(m.mb)} MB (solo la primera vez)`
        : 'Preparando la búsqueda por significado…');
      break;
    case 'estructura':
      ultimoInforme = m.informe;
      cargarPiezas(procCol);
      refrescarTablero(procCol);
      pista(m.aIndexar
        ? `Estructura detectada. Preparando la búsqueda por significado de ${m.aIndexar} pieza(s)…`
        : 'Estructura detectada. No hubo cambios que procesar.');
      break;
    case 'sin-estructura': fallo('sin estructura', m.informe.mensaje, m.informe); break;
    case 'listo': terminarBien(m); break;
    case 'error': fallo('no se pudo procesar', m.mensaje); break;
    case 'resultados': { const f = esperando.get(m.id); if (f) { esperando.delete(m.id); f(m); } break; }
  }
};
worker.onerror = ev => { console.error(ev); if (modo === 'procesando') fallo('no se pudo procesar', 'Error interno del procesador: ' + (ev.message || '')); };

/* ---------- Máquina de estados del asistente activo ---------- */
function poner(m, texto) {
  modo = m;
  const a = ast();
  if (!a) return;
  etiqueta(texto || a.T.estados[m] || m);
  const on = m !== 'apagado';
  $('chip').className = 'chip-estado' + (m === 'exito' ? ' ok' : m === 'error' ? ' err' : on ? ' on' : '');
  a.titulo.classList.toggle('apagado', !on);
  meta.energy = on ? 1 : 0;
  meta.mult = { procesando: 3, buscando: 2 }[m] || 1;
  meta.apertura = m === 'esperando' ? 1 : 0;
  meta.temblor = m === 'procesando' ? 1 : 0;
  clearTimeout(poner.t);
  if (m === 'esperando') poner.t = setTimeout(() => $('subir').classList.add('abierta'), 380); else $('subir').classList.remove('abierta');
  bloquear();
  const n = a.col.asistente || a.col.nombre;
  $('consulta').placeholder = !on ? a.T.tocar(n) : m === 'procesando' ? a.T.procesando(n)
    : m === 'transformando' ? '' : hayDocumento() ? a.T.pedir(n) : 'Sube tu documento con 📎';
  if (!on) pista('');
  else if (m === 'activo' && !pista.fija) pista(hayDocumento() ? '' : 'Toca 📎 para subir tu documento .docx');
  if (m === 'apagado' && actualizacionPendiente) recargarConVersionNueva();
}
/* Controles libres solo con el asistente activo y sin transición */
function bloquear() {
  const libre = modo === 'activo' && !cambio && !viaje;
  $('consulta').disabled = $('btnSubir').disabled = $('btnBuscar').disabled = !libre;
  document.querySelectorAll('#sugerencias button:not(#cerrarTodas)').forEach(b => { b.disabled = !libre; });
  document.querySelectorAll('#selector button').forEach(b => { b.disabled = ocupado(); });
}
function etiqueta(t) { $('estado').textContent = t; }
function pista(t, clase = '', fijaMs = 0) {
  const h = $('hint'); h.textContent = t; h.className = clase;
  clearTimeout(pista.t); pista.fija = !!fijaMs;
  if (fijaMs) pista.t = setTimeout(() => { pista.fija = false; if (h.textContent === t) { h.textContent = ''; h.className = ''; } }, fijaMs);
}
function destellar(hex) { const S = ast().S; S.destello.color.set(hex); S.destello.k = 1; S.destello.h = 900; }

/* Encender / apagar con un toque sobre el asistente */
function alternar() {
  if (cambio || viaje || enMenu) return;
  if (modo === 'apagado') { poner('activo'); if (hayDocumento()) worker.postMessage({ tipo: 'precargar' }); }
  else if (modo === 'activo') { ast().ventanas.cerrarTodas(); poner('apagado'); }
}

/* ---------- Subir archivo ---------- */
$('btnSubir').onclick = () => { colocarVentana(); poner('esperando'); };   // subir no cierra las ventanas
$('cancelarSubir').onclick = () => poner('activo');
$('elegir').onclick = () => $('archivo').click();
$('archivo').onchange = ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) procesarArchivo(f); };
function colocarVentana() {
  const c = escenaDe(activa).proyectar(new THREE.Vector3(0, 0, 0)); const v = $('subir');
  v.style.left = c.x + 'px'; v.style.top = (c.y + Math.min(170, zona.clientHeight * 0.27)) + 'px';
}

/* Pantalla encendida mientras procesa (Screen Wake Lock API) */
let candado = null;
async function mantenerPantalla() {
  try { if ('wakeLock' in navigator && !candado && document.visibilityState === 'visible') { candado = await navigator.wakeLock.request('screen'); candado.addEventListener('release', () => { candado = null; }); } } catch {}
}
function soltarPantalla() { try { candado?.release(); } catch {} candado = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && modo === 'procesando') mantenerPantalla(); });

async function procesarArchivo(file) {
  procCol = activa; progreso = 0;
  poner('procesando', 'leyendo documento…');           // el hechizo se deshace y se irá rearmando
  contexto = 'nuevo';
  pista('');
  mantenerPantalla();
  try { navigator.storage?.persist?.(); } catch {}
  let buffer;
  try { buffer = await file.arrayBuffer(); }
  catch { return fallo('archivo no válido', 'No se pudo leer el archivo.'); }
  const documento = { nombre: file.name, tamano: file.size, fecha: file.lastModified || Date.now() };
  // Copia local para continuar si se interrumpe (no sale del dispositivo).
  try { await db.guardar('trabajos', { coleccion: procCol, archivo: buffer, documento, inicio: Date.now() }); } catch {}
  await leerYEnviar(buffer, documento);
}
async function leerYEnviar(buffer, documento) {
  let parrafos;
  try {
    parrafos = await leerDocx(buffer, f => { if (modo === 'procesando') { progreso = 0.1 * f; etiqueta(`leyendo documento ${Math.floor(100 * f)}%`); } });
  } catch (e) {
    await db.borrar('trabajos', procCol).catch(() => {});
    return fallo(e.codigo === 'no-docx' ? 'archivo no válido' : 'no se pudo procesar', e.message);
  }
  worker.postMessage({ tipo: 'procesar', coleccion: procCol, analizador: AST[procCol].col.analizador, documento, parrafos });
}
function fallo(texto, detalle, informe = null) {
  soltarPantalla();
  refrescarTablero();
  destellar('#ff4d5e'); poner('error', texto);
  pista(detalle || '', 'err', 9000);
  if (informe) setTimeout(() => abrirHoja('Estructura detectada', htmlEstructura(informe, { error: true }), { clase: 'err' }), 700);
  setTimeout(() => { if (modo === 'error') poner('activo'); }, 1800);
}
async function terminarBien(m) {
  soltarPantalla();
  const id = procCol;
  await cargarPiezas(id);
  refrescarTablero(id);
  progreso = 1;
  destellar('#3ddc84'); poner('exito');
  if (m.semantica === 'pendiente')
    pista('Documento listo para búsqueda exacta. La búsqueda por significado se completará cuando haya conexión para descargar el modelo (una sola vez).', 'ok', 12000);
  else pista('');
  const reg = await db.obtener('colecciones', id);
  if (contexto === 'nuevo' && (ultimoInforme || reg?.informe))
    setTimeout(() => abrirHoja('Estructura detectada', htmlEstructura(ultimoInforme || reg.informe, { documento: reg?.documento }), { clase: 'ok' }), 900);
  contexto = null;
  setTimeout(() => { if (modo === 'exito') poner('activo'); }, 1800);
}
/* Si se interrumpió (se cerró la app, se apagó la pantalla…), continúa donde se quedó. */
async function reanudarSiHaceFalta(id) {
  const trabajo = await db.obtener('trabajos', id).catch(() => null);
  if (id !== activa || modo === 'procesando' || cambio || viaje) return;
  if (trabajo?.archivo) {
    contexto = 'nuevo'; procCol = id; progreso = 0;
    poner('procesando', 'reanudando…'); mantenerPantalla();
    pista('Continuando con el documento que se estaba procesando…');
    await leerYEnviar(trabajo.archivo, trabajo.documento);
    return;
  }
  const [reg, pend] = await Promise.all([db.obtener('colecciones', id), db.contar('fragmentos', 'pend', id)]);
  if (id !== activa || modo === 'procesando' || cambio || viaje) return;
  if (reg && pend && (reg.estado !== 'sin-modelo' || navigator.onLine)) {
    contexto = 'reanudar'; procCol = id; progreso = 0;
    poner('procesando', 'reanudando…'); mantenerPantalla();
    pista('Continuando donde se quedó…');
    worker.postMessage({ tipo: 'reanudar', coleccion: id });
  }
}

/* ---------- Buscar ---------- */
function pedirBusqueda(consulta, col) {
  const id = ++idBusqueda;
  return new Promise(ok => {
    esperando.set(id, ok);
    worker.postMessage({ tipo: 'buscar', id, coleccion: col, analizador: AST[col].col.analizador, consulta });
  });
}
async function buscar(q) {
  q = (q || '').trim();
  if (!q || modo !== 'activo' || cambio || viaje) return;
  const a = ast();
  $('consulta').value = q;
  $('consulta').blur();
  poner('buscando'); pista('');                       // las ventanas anteriores se quedan
  const t0 = performance.now();
  const r = await pedirBusqueda(q, a.id);
  const resto = 900 - (performance.now() - t0);        // que se vea la búsqueda (x2)
  if (resto > 0) await new Promise(ok => setTimeout(ok, resto));
  const n = r.resultados.length;
  poner('activo', n ? `${n} resultado${n === 1 ? '' : 's'}` : 'sin resultados');
  if (r.aviso) pista(r.aviso, n ? '' : 'err', 8000);
  else if (!n) pista('No encontré ese texto en tu documento.', 'err', 6000);
  a.ventanas.mostrar(r.resultados.map(x => ({ ...x, corta: x.corta || '·', col: a.id, tema: a.tema })));
  recordar(q, a.id);
}
$('form').onsubmit = ev => { ev.preventDefault(); buscar($('consulta').value); };

/* ---------- Sugerencias: últimas 3 búsquedas (o ejemplos) e Índice ---------- */
const claveRecientes = id => id === idLecturas ? 'anesthios.recientes' : `anesthios.recientes.${id}`;
function leerRecientes(id) {
  try { const v = JSON.parse(leer(claveRecientes(id)) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 3) : []; }
  catch { return []; }
}
function recordar(q, id) {
  const lista = [q, ...leerRecientes(id).filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 3);
  escribir(claveRecientes(id), JSON.stringify(lista));
  if (id === activa) pintarSugerencias(id);
}
function pintarSugerencias(id = activa) {
  if (!id) return;
  const r = leerRecientes(id);
  const cont = $('recientes'); cont.innerHTML = '';
  for (const q of r.length ? r : (AST[id].A.EJEMPLOS || [])) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.q = q; b.textContent = q; b.disabled = !(modo === 'activo' && !cambio && !viaje);
    b.onclick = () => buscar(q);
    cont.append(b);
  }
}
$('sugIndice').onclick = () => lector.abrirIndice(activa);
$('cerrarTodas').onclick = () => ast()?.ventanas.cerrarTodas();

/* ---------- Enlaces entre colecciones ---------- */
const RE_LECT = /\b(Lect|Evang|Salmo)\.?\s*Gonz\.?\s*(\d{1,4})\b/g;
const TIPO_CITA = { Lect: 'lectura', Evang: 'evangelio', Salmo: 'salmo' };
const RE_PALABRA = /Palabra del Señor,\s*(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+(?:de\s+)?\d{4})/gi;
function enlazarCitas(html, colId) {
  const a = AST[colId];
  if (!a || colId === idLecturas || !idLecturas) return html;
  html = html.replace(RE_LECT, (m, t, n) => `<a class="enlace" href="#" data-col="${idLecturas}" data-tipo="${TIPO_CITA[t]}" data-n="${n}">${m}</a>`);
  if (a.A.fechaDe) html = html.replace(RE_PALABRA, (m, f) => {
    const fecha = a.A.fechaDe(f), p = fecha && a.piezas.find(x => x.fecha === fecha);
    return p ? `<a class="enlace" href="#" data-col="${colId}" data-id="${p.id}">${m}</a>` : m;
  });
  return html;
}
function alEnlace(el) {
  const col = el.dataset.col;
  if (el.dataset.id) return abrirComoVentana(col, el.dataset.id);
  const L = AST[col];
  if (!L || !L.piezas.length) return pista('La colección de Lecturas no está cargada en este dispositivo: súbela desde Agios.', 'err', 7000);
  const id = `${col}|${el.dataset.tipo}:${el.dataset.n}`;
  if (!L.piezas.some(p => p.id === id)) return pista(`No existe ${el.textContent} en tus Lecturas.`, 'err', 6000);
  abrirComoVentana(col, id);
}
/* Abre una pieza (de cualquier colección) como ventana sobre el asistente activo */
function abrirComoVentana(col, id) {
  const c = AST[col], p = c.piezas.find(x => x.id === id);
  if (!p || !activa) return;
  const idx = Math.max(0, p.parrafos.findIndex(t => !c.A.esMarca(t)));
  let texto = p.parrafos[idx] || '';
  if (texto.length > 380) texto = texto.slice(0, 380).replace(/\s+\S*$/, '') + '…';
  ast().ventanas.mostrar([{
    pieza: id, col, tema: c.tema, ...c.A.etiqueta(p), corta: c.A.corta ? c.A.corta(p) : '·', origen: col === activa ? 'referencia' : 'cita',
    extracto: { texto, intervalos: [] }, pasaje: { parrafoIni: idx, parrafoFin: idx, intervalos: [] },
  }]);
}

/* ---------- Cambiar de asistente: Implosión o Estallido ---------- */
const DURACION = { implosion: 7000, estallido: 6000, fundido: 1400 };
function cambiar(a) {
  if (!activa || a === activa || !AST[a] || ocupado() || enMenu) return;
  const de = activa, va = AST[de], llega = AST[a];
  escenaDe(a);
  lector.cerrar(); if (hojaAbierta()) cerrarHoja();
  va.cont.hidden = true;                                    // sus ventanas se guardan
  llega.S.apertura = 1; llega.S.rot = va.S.rot; llega.S.energy = 1; llega.S.mult = 1;   // el que llega empieza deshecho
  const pref = leerAjuste('anesthios.transicion');
  let estilo = pref === 'azar' ? (Math.random() < 0.5 ? 'implosion' : 'estallido') : pref;
  if (!WEBGL2) estilo = 'fundido';
  cambio = { de, a, t: 0, modo: estilo, dur: DURACION[estilo], cambioTema: false };
  if (estilo !== 'fundido') { asegurarTrans(); trans.correr(va.col.escena, llega.col.escena, cambio.dur, estilo); }
  else stage.classList.add('fundido');
  poner('transformando');
}
function coreografiaCambio(dT) {
  if (!cambio) return;
  cambio.t += dT;
  const p = lim(cambio.t / cambio.dur), va = AST[cambio.de], llega = AST[cambio.a];
  if (cambio.modo === 'implosion') {
    // es absorbido: gira más rápido, se encoge hacia su centro y se apaga
    va.S.mult = 1 + 3 * suave(lim(p / 0.15)); const enc = suave(lim(p / 0.17));
    va.capa.style.opacity = 1 - suave(lim((p - 0.06) / 0.11)); va.capa.style.transform = `scale(${1 - 0.85 * enc}) rotate(${enc * 40}deg)`;
    $('fogonazo').style.opacity = Math.exp(-Math.pow((p - 0.18) / 0.04, 2));
  } else if (cambio.modo === 'estallido') {
    va.S.apertura = Math.max(va.S.apertura, suave(lim(p / 0.18))); va.S.mult = 1 + 2 * suave(lim(p / 0.15));
    va.capa.style.opacity = 1 - suave(lim((p - 0.05) / 0.2));
    va.capa.style.transform = va.tema === 'agios' ? `scale(${1 + 0.35 * suave(lim(p / 0.25))})` : `scale(${1 + 0.15 * suave(lim(p / 0.25))})`;
  } else va.capa.style.opacity = p < 0.5 ? 1 - p * 2 : 0;
  // a la mitad: cambia el mundo (fondo, colores, títulos, selector, paneles)
  if (p > (cambio.modo === 'implosion' ? 0.36 : cambio.modo === 'estallido' ? 0.42 : 0.5) && !cambio.cambioTema) {
    cambio.cambioTema = true;
    ponerTema(llega.tema);
    llega.titulo.classList.remove('apagado');
    mostrarUI(cambio.a);
  }
  // el que llega: aparece mientras las partículas lo dibujan y se termina de armar
  const ini = cambio.modo === 'implosion' ? 0.74 : cambio.modo === 'estallido' ? 0.68 : 0.5;
  const fl = suave(lim((p - ini) / (cambio.modo === 'fundido' ? 0.5 : 0.2)));
  llega.capa.style.opacity = fl; llega.capa.style.transform = `scale(${0.92 + 0.08 * fl})`;
  llega.S.apertura = 1 - suave(lim((p - ini + 0.02) / (0.98 - ini))); llega.S.mult = 1;
  if (p >= 1) {
    va.capa.style.opacity = 0; va.S.apertura = 0; va.S.mult = 1; va.capa.style.transform = ''; $('fogonazo').style.opacity = 0;
    llega.capa.style.transform = ''; llega.capa.style.opacity = 1; stage.classList.remove('fundido');
    const a = cambio.a;
    cambio = null;
    llegar(a, true);
  }
}
/* Un asistente queda activo (tras entrar desde el menú o cambiar) */
function llegar(id, encendido) {
  activa = id;
  escribir('anesthios.coleccion', id); escribir('anesthios.tema', AST[id].tema);
  ponerTema(AST[id].tema);
  for (const k in AST) AST[k].cont.hidden = k !== id;           // vuelven sus ventanas
  mostrarUI(id);
  if (encendido) AST[id].S.energy = 1;
  poner(encendido ? 'activo' : 'apagado');
  reanudarSiHaceFalta(id).catch(e => console.error(e));
  if (encendido && hayDocumento(id)) worker.postMessage({ tipo: 'precargar' });
}

/* ---------- Menú nebulosa: entrar a un asistente y volver ---------- */
function entrar(id) {
  if (viaje || !enMenu || !AST[id]) return;
  const a = AST[id];
  escenaDe(id);
  activa = id;
  viaje = { tipo: 'entrar', col: id, cambioTema: false, t: 0, dur: WEBGL2 ? 9000 : 1400 };
  $('menu').classList.add('fuera');
  a.S.apertura = 1; a.S.rot = 0; a.S.tilt = 0; a.S.rotVel = 0; a.S.energy = 1; a.S.mult = 1;
  for (const k in AST) { AST[k].titulo.classList.toggle('fuera', k !== id); AST[k].capa.style.opacity = 0; }
  a.titulo.classList.remove('apagado');
  modo = 'transformando'; bloquear();
  if (WEBGL2) { asegurarNeb(); neb.formar(a.col.escena, 9000); }
}
function volver() {
  if (viaje || enMenu || ocupado() || !activa) return;
  const a = ast();
  lector.cerrar(); if (hojaAbierta()) cerrarHoja();
  a.cont.hidden = true;                                       // sus ventanas se guardan
  viaje = { tipo: 'volver', col: activa, cambioTema: false, t: 0, dur: WEBGL2 ? 4800 : 1200 };
  enMenu = true;
  modo = 'transformando'; bloquear();
  $('cielo').classList.remove('oculto');
  if (WEBGL2) { asegurarNeb(); neb.disolver(a.col.escena, 4800); }
}
$('aInicio').onclick = volver;
function coreografiaMenu(dT) {
  if (!viaje) return;
  viaje.t += dT;
  const p = neb ? neb.progreso : lim(viaje.t / viaje.dur), m = AST[viaje.col];
  if (viaje.tipo === 'entrar') {
    if (p > 0.5 && !viaje.cambioTema) { viaje.cambioTema = true; ponerTema(m.tema); mostrarUI(viaje.col); }   // aparece su mundo
    const ini = neb ? 0.74 : 0.4;
    const fl = suave(lim((p - ini) / 0.2)); m.capa.style.opacity = fl; m.capa.style.transform = `scale(${0.94 + 0.06 * fl})`;
    m.S.apertura = 1 - suave(lim((p - (neb ? 0.72 : 0.4)) / 0.28));                // Kyrien rearma su roca; Agios cierra su núcleo
  } else {
    const fv = 1 - suave(lim(p / 0.2)); m.capa.style.opacity = fv; m.S.apertura = suave(lim(p / 0.15)); m.S.mult = 1 + 2 * suave(lim(p / 0.15));
    if (p > 0.3 && !viaje.cambioTema) { viaje.cambioTema = true; ponerTema('menu'); }
    if (p > 0.62) $('menu').classList.remove('fuera');
  }
  if (!neb && p >= 1) finViaje();
}
function finViaje() {
  const v = viaje, m = AST[v.col];
  viaje = null;
  if (v.tipo === 'entrar') {
    m.capa.style.opacity = 1; m.capa.style.transform = ''; m.S.apertura = 0;
    enMenu = false; $('cielo').classList.add('oculto');
    llegar(v.col, true);
  } else {
    m.capa.style.opacity = 0; m.S.apertura = 0; m.S.mult = 1;
    modo = 'apagado'; activa = null; bloquear();
    $('menu').classList.remove('fuera');
    if (actualizacionPendiente) recargarConVersionNueva();
  }
}

/* ---------- Menú ☰ (ajustes, documentos, espacio) ---------- */
$('btnMenu').onclick = abrirMenu;
async function abrirMenu() {
  if (cambio || viaje) return;                 // mientras se entra, se vuelve o se cambia, nada más
  const cols = await Promise.all(COLECCIONES.map(async c => {
    const registro = await db.obtener('colecciones', c.id);
    let estadoIndice = '—';
    if (registro) {
      const [pend, total] = await Promise.all([db.contar('fragmentos', 'pend', c.id), db.contar('fragmentos', 'coleccion', c.id)]);
      estadoIndice = !pend ? 'lista' : `${Math.floor(100 * (total - pend) / (total || 1))}% (${pend} fragmentos pendientes${registro.estado === 'sin-modelo' ? '; falta descargar el modelo' : ''})`;
    }
    return { ...c, registro, estadoIndice, activa: c.id === activa };
  }));
  let uso = null, persistente = false;
  try { uso = await navigator.storage.estimate(); } catch {}
  try { persistente = await navigator.storage.persisted(); } catch {}
  const sinConexion = !!navigator.serviceWorker?.controller;
  const cont = abrirHoja('Menú', htmlMenu({ colecciones: cols, uso, persistente, sinConexion, ajustes: htmlAjustes() }));
  cont.querySelectorAll('.ajustes input[type=radio]').forEach(r => r.onchange = () => guardarAjuste(r.name, r.value));
  cont.querySelectorAll('[data-accion]').forEach(b => b.onclick = async () => {
    const id = b.closest('[data-col]')?.dataset.col;
    const reg = cols.find(c => c.id === id)?.registro;
    switch (b.dataset.accion) {
      case 'estructura': if (reg?.informe) abrirHoja('Estructura detectada', htmlEstructura(reg.informe, { documento: reg.documento }), { clase: 'ok' }); break;
      case 'indice': cerrarHoja(); lector.abrirIndice(id); break;
      case 'usar': cerrarHoja(); cambiar(id); break;
      case 'persistir': try { await navigator.storage.persist(); } catch {} abrirMenu(); break;
      case 'borrar':
        if (modo === 'procesando') { alert('Espera a que termine el procesamiento.'); break; }
        if (!confirm(`¿Borrar la colección «${cols.find(c => c.id === id).nombre}» de este dispositivo? Tendrás que volver a subir el documento. Las demás colecciones no se tocan.`)) break;
        await db.borrarColeccion(id);
        worker.postMessage({ tipo: 'invalidar', coleccion: id });
        AST[id].piezas = []; AST[id].ventanas.cerrarTodas();
        if (id === activa) { lector.cerrar(); refrescarTablero(); if (modo === 'activo') poner('activo'); }
        abrirMenu();
        break;
    }
  });
}

/* ---------- Gestos: tocar = encender/apagar, arrastrar = girar, pellizcar = zoom ---------- */
const ptrs = new Map(); let down = null, pinch0 = null;
const Sact = () => ast()?.S;
stage.addEventListener('pointerdown', ev => {
  if (!activa || cambio || viaje || enMenu) return;
  stage.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (ptrs.size === 1) down = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: false };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: Sact().zoom }; if (down) down.moved = true; }
});
stage.addEventListener('pointermove', ev => {
  const p = ptrs.get(ev.pointerId); if (!p || !Sact()) return;
  const S = Sact(), dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
  if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; S.zoom = Math.max(0.5, Math.min(2.5, pinch0.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d)); return; }
  if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 8) down.moved = true;
  if (down && down.moved) { S.rot += dx * 0.008; S.rotVel = dx * 0.008; S.tilt = Math.max(-0.3, Math.min(0.7, S.tilt + dy * 0.004)); }
});
function up(ev) {
  ptrs.delete(ev.pointerId); if (ptrs.size < 2) pinch0 = null;
  if (ptrs.size === 0 && down) { if (!down.moved && performance.now() - down.t < 300) alternar(); down = null; }
}
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
stage.addEventListener('wheel', ev => { ev.preventDefault(); const S = Sact(); if (S) S.zoom = Math.max(0.5, Math.min(2.5, S.zoom * Math.exp(-ev.deltaY * 0.001))); }, { passive: false });
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (hojaAbierta()) cerrarHoja(); else if ($('lector').classList.contains('abierto')) lector.cerrar();
  else if (modo === 'esperando') poner('activo');
});

/* ---------- Bucle: solo se dibujan las escenas visibles ---------- */
let last = performance.now();
function loop(t) {
  const dT = Math.min(50, Math.max(0, t - last)); last = t;
  coreografiaCambio(dT); coreografiaMenu(dT);
  for (const id in AST) {
    const a = AST[id];
    if (!a.escena) continue;
    const S = a.S;
    const enCambio = !!cambio && (id === cambio.de || id === cambio.a);
    const enViaje = !!viaje && id === viaje.col;
    const visible = (id === activa && !enMenu && !cambio) || enCambio || enViaje;
    if (id === activa && !enCambio && !enViaje && !enMenu) {
      S.energy = hacia(S.energy, meta.energy, dT, 0.95);
      S.mult = hacia(S.mult, meta.mult, dT, 0.93);
      // Kyrien: durante el procesamiento real el hechizo se rearma al ritmo del avance
      const objetivo = modo === 'procesando' && typeof a.escena.invocar === 'function' ? 1 - progreso : meta.apertura;
      S.apertura = hacia(S.apertura, objetivo, dT, 0.9);
      S.temblor = hacia(S.temblor, meta.temblor, dT, 0.9);
    } else if (enCambio || enViaje) {
      S.energy = hacia(S.energy, 1, dT, 0.95); S.temblor = hacia(S.temblor, 0, dT, 0.9);
    }
    S.destello.h = Math.max(0, (S.destello.h || 0) - dT); if (S.destello.h <= 0) S.destello.k = Math.max(0, S.destello.k - dT / 900);
    S.T += dT * 0.85 * S.mult * (0.15 + 0.85 * S.energy);
    if (!(down && id === activa)) { S.rot += S.rotVel; S.rotVel *= Math.pow(0.94, dT / 16.7); }
    if (visible) { a.escena.dibujar(t, dT); a.dibujos++; }      // la oculta no gasta GPU
  }
  if (trans) trans.dibujar(dT, cambio ? AST[cambio.de].S.rot : 0);
  if (neb && (enMenu || viaje)) {
    const fin = neb.dibujar(dT); nebDibujos++;
    if (fin && viaje && fin === (viaje.tipo === 'entrar' ? 'formar' : 'disolver')) finViaje();
  }
  if (modo === 'esperando') colocarVentana();
  if (activa && !enMenu) tablero.cuadro(AST[activa].S, dT);
  requestAnimationFrame(loop);
}

/* ---------- Arranque ---------- */
await Promise.all(COLECCIONES.map(c => cargarPiezas(c.id).catch(() => {})));
if (enMenu) {
  ponerTema('menu');
  if (WEBGL2) asegurarNeb();
  bloquear();
} else {
  // Ajuste «Al abrir la app: entrar al último asistente usado»
  const ult = coleccion(leer('anesthios.coleccion'))?.id || COLECCIONES[0].id;
  $('menu').classList.add('fuera'); $('cielo').classList.add('oculto');
  escenaDe(ult);
  AST[ult].capa.style.opacity = 1;
  llegar(ult, false);
}
layout();
requestAnimationFrame(loop);

/* Service worker: caché versionada para uso sin conexión.
   Cuando se instala una versión nueva de la app, se recarga en un momento
   tranquilo (en el menú, con el asistente apagado o la app en segundo
   plano), nunca a media tarea. Los datos guardados no se tocan. */
function recargarConVersionNueva() {
  if (ocupado()) return;
  location.reload();
}
if ('serviceWorker' in navigator) {
  const habiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador) return;
    actualizacionPendiente = true;
    if (modo === 'apagado' || (enMenu && !viaje)) recargarConVersionNueva();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && actualizacionPendiente) recargarConVersionNueva();
  });
  const buscarVersion = () => navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscarVersion(); });
  navigator.serviceWorker.register('./sw.js').then(buscarVersion).catch(e => console.warn('SW', e));
}

/* Estado de solo lectura para diagnóstico y pruebas automáticas */
Object.defineProperty(window, '__agios', { value: Object.freeze({
  get modo() { return modo; }, get activa() { return activa; }, get enMenu() { return enMenu; },
  get viaje() { return viaje ? viaje.tipo : null; }, get cambio() { return cambio ? { de: cambio.de, a: cambio.a, modo: cambio.modo, dur: cambio.dur } : null; },
  get tema() { return document.body.className; }, get progreso() { return progreso; },
  get destello() { const S = ast()?.S; return S ? { k: S.destello.k, color: '#' + S.destello.color.getHexString() } : null; },
  get meta() { return { ...meta }; }, get S() { const S = ast()?.S; return S ? { rot: S.rot, energy: S.energy, apertura: S.apertura, mult: S.mult } : null; },
  get piezas() { return ast()?.piezas.length ?? 0; }, get ventanas() { return ast()?.ventanas.abiertas() ?? 0; },
  get coleccion() { return activa; }, get dibujos() { return Object.fromEntries(Object.entries(AST).map(([k, a]) => [k, a.dibujos])); },
  get nebulosa() { return nebDibujos; }, webgl2: WEBGL2, app: 'Anesthios',
}) });
