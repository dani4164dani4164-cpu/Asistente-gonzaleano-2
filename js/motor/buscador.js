/* ============================================================
   Búsqueda: exacta (frases y palabras sin importar acentos ni
   mayúsculas) + por significado (embeddings), combinadas en un
   solo ranking. Puro: el Worker le pasa los datos y los vectores.
   Nunca redacta: solo devuelve pasajes reales del documento.
   ============================================================ */
import { normalizarConMapa, normalizarBusqueda, palabrasClave, frasesConPosicion } from '../texto.js';

/**
 * Prepara los datos de una colección para buscar.
 *   piezas:     [{id, tipo, numero, grupo, parrafos, ...}] en orden del documento
 *   fragmentos: [{id, pieza, parrafoIni, parrafoFin, texto, desde?, hasta?, vector?}]
 */
export function prepararDatos(piezas, fragmentos, esMarca, dimensiones) {
  const porId = new Map(piezas.map(p => [p.id, p]));
  const parrafos = [];
  for (const p of piezas) p.parrafos.forEach((t, i) => {
    parrafos.push({ pieza: p.id, idx: i, texto: t, norm: normalizarConMapa(t), marca: esMarca(t) });
  });
  const conVector = fragmentos.filter(f => f.vector && porId.has(f.pieza));
  const matriz = new Float32Array(conVector.length * dimensiones);
  conVector.forEach((f, i) => matriz.set(f.vector, i * dimensiones));
  return {
    piezas, porId, parrafos, dimensiones, matriz,
    fragmentos: conVector.map(({ vector, ...resto }) => resto),
    pendientes: fragmentos.length - conVector.length,
    totalFragmentos: fragmentos.length,
  };
}

/* ---------- Exacta ---------- */
const variantes = w => {
  const v = new Set([w, w + 's', w + 'es']);
  if (w.length > 3 && w.endsWith('s')) v.add(w.slice(0, -1));
  if (w.length > 4 && w.endsWith('es')) v.add(w.slice(0, -2));
  return [...v];
};

/** Intervalo en el texto original de una coincidencia [a, b) del texto normalizado. */
function aOriginal(norm, a, b) {
  return [norm.mapa[a], norm.mapa[b - 1] + 1];
}

function ocurrencias(norm, aguja) {            // aguja = ' x y '
  const out = [];
  let i = norm.texto.indexOf(aguja);
  while (i >= 0) { out.push(aOriginal(norm, i + 1, i + aguja.length - 1)); i = norm.texto.indexOf(aguja, i + 1); }
  return out;
}

/**
 * → { frase: [{pieza, parrafo, intervalos, puntaje}], palabras: [...] }
 *   frase:    párrafos que contienen la frase completa
 *   palabras: párrafos con las palabras clave en cualquier orden (ponderadas por rareza)
 */
export function buscarExacta(datos, consulta) {
  const qn = normalizarBusqueda(consulta);
  const limpio = qn.trim();
  if (!limpio) return { frase: [], palabras: [] };
  const clave = [...new Set(palabrasClave(limpio))];
  const varis = clave.map(variantes);

  const frase = [];
  const brutos = [];
  const df = new Array(clave.length).fill(0);
  for (const pr of datos.parrafos) {
    const occ = ocurrencias(pr.norm, qn);
    if (occ.length) frase.push({ pieza: pr.pieza, parrafo: pr.idx, intervalos: occ, puntaje: (pr.marca ? 0.3 : 1) * (1 + Math.log(occ.length)) });
    if (clave.length > 1 || !occ.length) {
      let tiene = 0; const iv = []; const cuales = [];
      clave.forEach((w, k) => {
        let encontrado = false;
        for (const v of varis[k]) {
          const o = ocurrencias(pr.norm, ' ' + v + ' ');
          if (o.length) { encontrado = true; iv.push(...o); }
        }
        if (encontrado) { tiene++; df[k]++; cuales.push(k); }
      });
      if (tiene) brutos.push({ pr, iv, cuales });
    } else {
      brutos.push({ pr, iv: occ, cuales: [0] }); df[0]++;
    }
  }
  const N = Math.max(1, datos.parrafos.length);
  const idf = df.map(d => Math.log(1 + N / (1 + d)));
  const totalIdf = idf.reduce((a, b) => a + b, 0) || 1;
  const minimo = clave.length <= 2 ? clave.length : Math.ceil(clave.length * 0.6);
  const palabras = brutos
    .filter(b => b.cuales.length >= minimo)
    .map(b => {
      const cobertura = b.cuales.reduce((a, k) => a + idf[k], 0) / totalIdf;
      return {
        pieza: b.pr.pieza, parrafo: b.pr.idx, intervalos: b.iv,
        puntaje: (b.pr.marca ? 0.3 : 1) * cobertura * cobertura * (1 + 0.15 * Math.log(1 + b.iv.length)),
      };
    });
  const orden = (a, b) => b.puntaje - a.puntaje;
  return { frase: frase.sort(orden), palabras: palabras.sort(orden), clave };
}

/* ---------- Por significado ---------- */
/** Producto punto (los vectores ya vienen normalizados) → mejores k fragmentos. */
export function buscarSignificado(datos, vector, k = 40) {
  const { matriz, dimensiones: d, fragmentos } = datos;
  const n = fragmentos.length;
  const puntajes = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; const o = i * d;
    for (let j = 0; j < d; j++) s += matriz[o + j] * vector[j];
    puntajes[i] = s;
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => puntajes[b] - puntajes[a]).slice(0, k);
  return idx.map(i => ({ ...fragmentos[i], puntaje: puntajes[i] }));
}

/* ---------- Ranking combinado ---------- */
const mejorPorPieza = lista => {
  const m = new Map();
  for (const x of lista) if (!m.has(x.pieza)) m.set(x.pieza, x);
  return [...m.values()];
};

/**
 * Fusión por rango recíproco (RRF) de las tres listas, por pieza.
 * → [{pieza, origen, pasaje:{parrafoIni, parrafoFin, texto, intervalos}, necesitaFrase}]
 */
export function fusionar(datos, exacta, significado, { minimo = 2, maximo = 5 } = {}) {
  const K = 8;
  const listas = [
    { nombre: 'frase', peso: 1.6, items: mejorPorPieza(exacta.frase) },
    { nombre: 'palabras', peso: 1.0, items: mejorPorPieza(exacta.palabras) },
    { nombre: 'significado', peso: 1.0, items: mejorPorPieza(significado) },
  ];
  const acum = new Map();
  for (const l of listas) l.items.forEach((x, r) => {
    const a = acum.get(x.pieza) || { pieza: x.pieza, puntaje: 0, de: {} };
    a.puntaje += l.peso / (K + r + 1);
    a.de[l.nombre] = x;
    acum.set(x.pieza, a);
  });
  const orden = [...acum.values()].sort((a, b) => b.puntaje - a.puntaje);
  if (!orden.length) return [];
  const tope = orden[0].puntaje;
  let n = orden.filter(x => x.puntaje >= tope * 0.45).length;
  n = Math.max(Math.min(minimo, orden.length), Math.min(maximo, n));
  const clave = exacta.clave || [];

  return orden.slice(0, n).map(x => {
    const pieza = datos.porId.get(x.pieza);
    const ex = x.de.frase || x.de.palabras;
    let pasaje, origen;
    if (ex) {
      origen = x.de.significado ? 'exacta y por significado' : 'coincidencia exacta';
      pasaje = { parrafoIni: ex.parrafo, parrafoFin: ex.parrafo, texto: pieza.parrafos[ex.parrafo], intervalos: ex.intervalos };
    } else {
      const f = x.de.significado;
      origen = 'por significado';
      const texto = f.texto;
      // Resalta las palabras de la consulta que aparezcan en el fragmento…
      const norm = normalizarConMapa(texto);
      const iv = [];
      for (const w of clave) if (w.length > 3) for (const v of variantes(w)) iv.push(...ocurrencias(norm, ' ' + v + ' '));
      pasaje = { parrafoIni: f.parrafoIni, parrafoFin: f.parrafoFin, desde: f.desde, texto, intervalos: iv };
    }
    return { pieza: x.pieza, origen, puntaje: x.puntaje, pasaje, necesitaFrase: !ex };
  });
}

/** Frases de un pasaje (para resaltar la más cercana a la consulta). */
export const frasesDe = texto => frasesConPosicion(texto);

/**
 * Recorta un pasaje largo alrededor del primer resaltado.
 * → {texto, intervalos} con los intervalos ajustados al recorte.
 */
export function recortar(texto, intervalos, max = 380) {
  if (texto.length <= max) return { texto, intervalos };
  const iv = [...intervalos].sort((a, b) => a[0] - b[0]);
  const centro = iv.length ? iv[0][0] : 0;
  let a = Math.max(0, centro - Math.floor(max * 0.3));
  let b = Math.min(texto.length, a + max);
  a = Math.max(0, b - max);
  if (a > 0) { const s = texto.lastIndexOf(' ', a + 20); if (s > a - 1 && s < centro) a = s + 1; }
  if (b < texto.length) { const s = texto.indexOf(' ', b - 20); if (s > 0 && s < b + 20) b = s; }
  const pre = a > 0 ? '…' : '', post = b < texto.length ? '…' : '';
  return {
    texto: pre + texto.slice(a, b) + post,
    intervalos: iv.filter(([x, y]) => y > a && x < b).map(([x, y]) => [Math.max(x, a) - a + pre.length, Math.min(y, b) - a + pre.length]),
  };
}
