/* ============================================================
   Analizador «doctrina»: Doctrina Gonzaleana (asistente Kyrien).

   En este documento los estilos de Word NO son confiables (unos
   bloques usan «heading 1», otros son texto normal). El nivel de cada
   título se decide por su FORMATO VISUAL (ver docs/KYRIEN.md, punto 2):

     Bloque    tamaño ≥ 60 medios puntos (≥ 30 pt) y centrado
     Parte     negrita, centrado, empieza con «PARTE »
     Capítulo  negrita, centrado, tamaño 28–40; varias líneas seguidas
               forman UN solo título; «(PRIMERA COMUNIÓN)» es etiqueta
     Sección   «heading 3»; o párrafo corto (≤ 14 palabras) todo en
               negrita, justificado, que termina en «._» o va entre
               comillas; o fecha corta en negrita terminada en «:» (Logos)

   Lo que no encaja es cuerpo del nivel en que esté. Las listas (numPr)
   siempre son cuerpo. No redacta ni interpreta: solo reparte el texto.

   Unidad de lectura y búsqueda: la sección; si no hay, el capítulo
   (o el texto propio de la parte o del bloque).
   Identidad de cada pieza: la ruta de títulos normalizada
   (bloque › capítulo › sección), nunca la posición.
   ============================================================ */
import { normalizarSimple, limpiarEspacios, contarPalabras } from '../texto.js';

export const id = 'doctrina';
export const TIPOS = {};                        // los bloques son dinámicos
export const NOMBRE_GRUPO = 'capítulo';
export const PANEL = { etiqueta: 'Bloques', campo: 'bloques' };
export const NAVEGACION = 'orden';              // anterior/siguiente en orden del documento
export const EJEMPLOS = ['Crónicas', 'Logos', 'la misericordia del Padre'];

/* ---------- Utilidades ---------- */
const COMILLAS = /[“”"«»„‟'‘’]/g;
/** Clave estable de un título: sin acentos, comillas, signos ni mayúsculas. */
export function claveTitulo(t) {
  return normalizarSimple(t).replace(COMILLAS, ' ').replace(/[^a-z0-9ñ]+/g, '-').replace(/^-+|-+$/g, '') || 'sin-titulo';
}
/** Texto comparable para búsquedas por título. */
const comparable = t => normalizarSimple(t).replace(COMILLAS, ' ').replace(/[^a-z0-9ñ]+/g, ' ').trim();

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a', 'al', 'por', 'para', 'o']);
/** «CRISTOLOGÍA GONZALEANA» → «Cristología Gonzaleana» */
export function tituloCaso(t) {
  return String(t).toLowerCase().split(/(\s+)/).map((w, i) =>
    /\s/.test(w) || (i > 0 && MINUSCULAS.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

const ABREV = [
  [/^doctrina gonzaleana/, 'Prel'], [/cristolog/, 'Crist'], [/mariolog/, 'Mario'], [/gonzaleanolog/, 'Gonz'],
  [/estigma/, 'Estig'], [/catequesis/, 'Cateq'], [/credo/, 'Credo'], [/teofan/, 'Teof'], [/logos/, 'Logos'],
  [/cronica/, 'Crón'], [/novenario/, 'Nov'],
];
export function abreviatura(bloque) {
  const n = normalizarSimple(bloque);
  for (const [re, a] of ABREV) if (re.test(n)) return a;
  const w = tituloCaso(String(bloque).split(/\s+/)[0] || '?');
  return w.slice(0, 5);
}

/* ---------- Fechas (entradas de Logos) ---------- */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const RE_FECHA = new RegExp(`(\\d{1,2})\\s+de\\s+(${MESES.join('|')}|setiembre)\\s+(?:de(?:l)?\\s+)?(\\d{4})`);
/** «Lunes 7 de Agosto de 2017:» → '2017-08-07' (o null) */
export function fechaDe(texto) {
  const m = RE_FECHA.exec(normalizarSimple(texto));
  if (!m) return null;
  const mes = m[2] === 'setiembre' ? 9 : MESES.indexOf(m[2]) + 1, d = +m[1];
  if (d < 1 || d > 31) return null;
  return `${m[3]}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const fechaCorta = f => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(2, 4)}`;
export const fechaLarga = f => `${+f.slice(8, 10)} de ${MESES[+f.slice(5, 7) - 1]} de ${f.slice(0, 4)}`;

/** «INTRODUCCIÓN» → 'Intro' · «PRÓLOGO» → 'Pról' · otro → '' */
function prefacio(t) {
  const n = normalizarSimple(t);
  return /^introduccion\b/.test(n) ? 'Intro' : /^prologo\b/.test(n) ? 'Pról' : '';
}

/* ---------- Clasificación de un párrafo por su formato ---------- */
const ENTRE_COMILLAS = /^[“"«„‟'‘][^]*[”"»'’][.:;,]?$/;
const TERMINA_PUNTO_GUION = /\._\s*$/;
const ES_DIA = /^(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/;

/** → 'bloque' | 'parte' | 'capitulo' | 'seccion' | 'etiqueta' | 'cuerpo'  (+ dudoso) */
export function clasificar(p) {
  const texto = limpiarEspacios(p.texto);
  if (!texto) return { tipo: 'vacio' };
  if (p.lista) return { tipo: 'cuerpo' };
  const n = normalizarSimple(texto);
  const centro = p.alin === 'center';
  const just = p.alin === 'both' || p.alin === 'distribute';
  const tam = p.tam || 0, b = !!p.negrita;
  const palabras = contarPalabras(texto);
  if (tam >= 60 && centro) return { tipo: 'bloque' };
  if (b && centro && /^parte\s/.test(n)) return { tipo: 'parte' };
  if (b && centro && /^\(.*\)$/.test(texto) && palabras <= 6) return { tipo: 'etiqueta' };
  if (b && centro && tam >= 28 && tam <= 40) return { tipo: 'capitulo' };
  if (p.nivel === 3) return { tipo: 'seccion' };
  if (b && just && palabras <= 14 && (TERMINA_PUNTO_GUION.test(texto) || ENTRE_COMILLAS.test(texto))) return { tipo: 'seccion' };
  if (b && palabras <= 10 && /:$/.test(texto) && ES_DIA.test(n) && fechaDe(texto)) return { tipo: 'seccion' };
  // Parece título pero no encaja: se lee como cuerpo y se informa.
  const dudoso = (b && (centro || tam >= 28) && palabras <= 20) || ((p.nivel === 1 || p.nivel === 2) && palabras <= 20);
  return { tipo: 'cuerpo', dudoso };
}

/* ---------- Análisis ---------- */
export function analizar(parrafos) {
  const arbol = [];                 // [{titulo, tipo:'bloque', hijos:[…]}]
  const piezas = [];
  const dudosos = [];
  let previo = 0, totalPalabras = 0;
  let B = null, P = null, C = null, S = null;   // nodos actuales
  let actual = null;                // pieza que recibe el cuerpo
  let titulo = null;                // título de varias líneas en construcción {tipo, lineas, etiquetas}
  const usadas = new Map();         // clave → veces (sufijo de ocurrencia)

  const nodo = (tipo, t, extra = {}) => ({ tipo, titulo: t, hijos: [], ...extra });
  const nuevaPieza = (nivelPieza, nodoPieza) => {
    const ruta = [B.titulo];
    if (nivelPieza === 'parte') ruta.push(P.titulo);
    if (nivelPieza === 'capitulo' || nivelPieza === 'seccion') { if (C) ruta.push(C.titulo); else if (P) ruta.push(P.titulo); }
    if (nivelPieza === 'seccion') ruta.push(S.titulo);
    const base = ruta.map(claveTitulo).join('›');
    const veces = (usadas.get(base) || 0) + 1; usadas.set(base, veces);
    const ultimo = ruta[ruta.length - 1] || '';
    const pz = {
      tipo: claveTitulo(B?.titulo || 'sin-bloque'),
      nivelPieza, ruta, clave: veces === 1 ? base : `${base}~${veces}`,
      bloque: B?.titulo || '', parte: P?.titulo || '', capitulo: C?.titulo || '', seccion: S && nivelPieza === 'seccion' ? S.titulo : '',
      etiquetas: C?.etiquetas?.slice() || [],
      titulo: ultimo, apellido: '',
      numero: nivelPieza === 'seccion' ? (C ? C.n : 0) : nivelPieza === 'capitulo' ? C.n : 0,
      prefacio: nivelPieza === 'capitulo' ? C.prefacio || '' : '',
      subnumero: nivelPieza === 'seccion' ? S.n : 0,
      grupo: claveTitulo(B?.titulo || '') + (C ? '›' + claveTitulo(C.titulo) : ''),
      fecha: nivelPieza === 'seccion' ? fechaDe(S.titulo) : null,
      parrafos: [],
    };
    piezas.push(pz);
    nodoPieza.pieza = pz;
    return pz;
  };
  /** Pieza del contenedor más profundo abierto (se crea al llegar el primer párrafo). */
  const piezaDelNivel = () => {
    if (S) return S.pieza || nuevaPieza('seccion', S);
    if (C) return C.pieza || nuevaPieza('capitulo', C);
    if (P) return P.pieza || nuevaPieza('parte', P);
    if (B) return B.pieza || nuevaPieza('bloque', B);
    return null;
  };

  /* Cierra un título de varias líneas y abre su nodo. */
  const cerrarTitulo = () => {
    if (!titulo) return;
    const t = titulo; titulo = null;
    const texto = t.lineas.join(' ');
    if (t.tipo === 'bloque') {
      B = nodo('bloque', texto); arbol.push(B); P = C = S = null; actual = null;
    } else if (t.tipo === 'capitulo') {
      if (!B) { B = nodo('bloque', 'SIN BLOQUE'); arbol.push(B); }
      // Introducción y Prólogo no cuentan en la numeración de capítulos
      const pre = prefacio(texto);
      if (!pre) B.nCaps = (B.nCaps || 0) + 1;
      C = nodo('capitulo', texto, { etiquetas: t.etiquetas, parte: P?.titulo || '', n: pre ? 0 : B.nCaps, prefacio: pre });
      (P || B).hijos.push(C); S = null; actual = null;
    }
  };

  parrafos.forEach((p, i) => {
    const c = clasificar(p);
    const texto = limpiarEspacios(p.texto);
    if (c.tipo === 'vacio') return;
    // Títulos de varias líneas: líneas seguidas del mismo tipo se unen.
    if (titulo && (c.tipo === titulo.tipo || (c.tipo === 'etiqueta' && titulo.tipo === 'capitulo'))) {
      if (c.tipo === 'etiqueta') titulo.etiquetas.push(texto.replace(/^\(|\)$/g, '').trim());
      else titulo.lineas.push(texto);
      return;
    }
    cerrarTitulo();
    if (c.tipo === 'bloque' || c.tipo === 'capitulo') { titulo = { tipo: c.tipo, lineas: [texto], etiquetas: [] }; return; }
    if (c.tipo === 'etiqueta' && C) { C.etiquetas.push(texto.replace(/^\(|\)$/g, '').trim()); if (C.pieza) C.pieza.etiquetas = C.etiquetas.slice(); return; }
    if (c.tipo === 'parte') {
      if (!B) { B = nodo('bloque', 'SIN BLOQUE'); arbol.push(B); }
      P = nodo('parte', texto); B.hijos.push(P); C = S = null; actual = null;
      return;
    }
    if (c.tipo === 'seccion') {
      if (!B) { B = nodo('bloque', 'SIN BLOQUE'); arbol.push(B); }
      // Introducción y Prólogo son preliminares del bloque: las entradas que
      // siguen (crónicas, fechas de Logos) son sus hermanas, no sus secciones.
      if (C?.prefacio) C = null;
      const padre = C || P || B;
      S = nodo('seccion', texto, { n: padre.hijos.filter(h => h.tipo === 'seccion').length + 1 });
      padre.hijos.push(S);
      actual = nuevaPieza('seccion', S);
      return;
    }
    // cuerpo
    totalPalabras += contarPalabras(texto);
    if (c.dudoso) dudosos.push({ texto, despuesDe: rutaTexto(B, C, S), tam: p.tam, negrita: p.negrita, alin: p.alin, estilo: p.estilo });
    if (!B) { previo++; return; }
    actual = piezaDelNivel();
    actual.parrafos.push(texto);
  });
  cerrarTitulo();

  // Cada pieza de la ruta conoce las etiquetas finales de su capítulo
  for (const pz of piezas) if (!pz.etiquetas.length) {
    const b = arbol.find(x => x.titulo === pz.bloque);
    const cap = b && buscarCap(b, pz.capitulo);
    if (cap?.etiquetas?.length) pz.etiquetas = cap.etiquetas.slice();
  }
  const reales = piezas.filter(pz => pz.parrafos.length || pz.nivelPieza === 'seccion');
  return { piezas: reales, informe: informe(arbol, reales, { dudosos, previo, totalParrafos: parrafos.length, totalPalabras }) };
}

function buscarCap(n, titulo) {
  for (const h of n.hijos) {
    if (h.tipo === 'capitulo' && h.titulo === titulo) return h;
    if (h.tipo === 'parte') { const r = buscarCap(h, titulo); if (r) return r; }
  }
  return null;
}
function rutaTexto(B, C, S) {
  return [B?.titulo, C?.titulo, S?.titulo].filter(Boolean).map(t => t.length > 40 ? t.slice(0, 40) + '…' : t).join(' › ') || 'inicio del documento';
}

function informe(arbol, piezas, { dudosos, previo, totalParrafos, totalPalabras }) {
  let capitulos = 0, secciones = 0;
  const recorrer = n => { for (const h of n.hijos) { if (h.tipo === 'capitulo') capitulos++; if (h.tipo === 'seccion') secciones++; recorrer(h); } };
  arbol.forEach(recorrer);
  const bloques = arbol.length;
  const datos = {
    bloques, capitulos, secciones, piezas: piezas.length,
    titulosBloques: arbol.map(b => b.titulo),
    dudosos, parrafos: totalParrafos, palabras: totalPalabras, textoSinBloque: previo,
  };
  const ok = bloques > 0 && piezas.length > 0;
  const avisos = [];
  if (dudosos.length) avisos.push({ titulo: 'Títulos dudosos (se leyeron como texto)', items: dudosos.map(d => `«${d.texto}» (después de ${d.despuesDe}; ${d.tam / 2} pt${d.negrita ? ', negrita' : ''}${d.alin === 'center' ? ', centrado' : ''})`) });
  if (previo) avisos.push({ titulo: 'Texto antes del primer bloque', items: [`${previo} párrafo(s) sin bloque; no se cuentan como pieza`] });
  const vacios = arbol.filter(b => !piezas.some(p => p.bloque === b.titulo));
  if (vacios.length) avisos.push({ titulo: 'Bloques sin texto', items: vacios.map(b => b.titulo) });

  // Árbol compacto para «Estructura detectada»: Bloque → (Parte) → Capítulo → Sección
  const compacto = n => ({ tipo: n.tipo, titulo: n.titulo, etiquetas: n.etiquetas?.length ? n.etiquetas : undefined, hijos: n.hijos.map(compacto) });
  const muestra = [arbol[0], arbol[arbol.length - 1]].filter((b, i, a) => b && a.indexOf(b) === i).map(b => ({
    titulo: b.titulo,
    lineas: piezas.filter(p => p.bloque === b.titulo).slice(0, 2).map(p => ({ ref: corta(p), titulo: p.titulo, inicio: (p.parrafos[0] || '').slice(0, 140) })),
  }));
  return {
    ok,
    mensaje: ok ? '' :
      'No se reconoció ningún bloque de la Doctrina. Kyrien reconoce los bloques por su formato: título centrado de 30 pt o más ' +
      '(por ejemplo «CRISTOLOGÍA GONZALEANA»). Revisa que el archivo sea el de la Doctrina Gonzaleana.',
    resumen: [
      { etiqueta: 'Bloques', valor: bloques },
      { etiqueta: 'Capítulos', valor: capitulos },
      { etiqueta: 'Secciones', valor: secciones },
      { etiqueta: 'Piezas de lectura', valor: piezas.length },
      { etiqueta: 'Párrafos / palabras', valor: `${totalParrafos.toLocaleString('es')} / ${totalPalabras.toLocaleString('es')}` },
    ],
    avisos, muestra, arbol: arbol.map(compacto), datos,
  };
}

/* ---------- Sin marcas propias: todo el texto entra a la búsqueda ---------- */
export const esMarca = () => false;
export const tipoDeMarca = () => null;

/* ---------- Cómo se muestra una pieza ---------- */
export function nombreBloque(p) { return tituloCaso(p.bloque || 'Doctrina'); }
export function etiqueta(p) {
  const bloque = nombreBloque(p);
  const ultimo = p.nivelPieza === 'bloque' ? '' : p.titulo;
  return { ref: ultimo ? `${bloque} · ${ultimo}` : bloque, tipo: bloque };
}
/** Etiqueta corta del panel «Abiertas»: Crist·2, Crón·12, Logos·20/09/25 */
export function corta(p) {
  const a = abreviatura(p.bloque);
  if (p.fecha) return `${a}·${fechaCorta(p.fecha)}`;
  if (p.nivelPieza === 'seccion') return p.numero ? `${a}·${p.numero}.${p.subnumero}` : `${a}·${p.subnumero}`;
  if (p.nivelPieza === 'capitulo') return `${a}·${p.prefacio || p.numero}`;
  return a;
}

/* ---------- Referencias que escribe el usuario ---------- */
/**
 * «Crónicas», «Logos», «Credo», «Te fallé», «El hijo de Dios»,
 * «Logos 20 de septiembre de 2025», «7 de agosto 2017»,
 * «Estigmas fundamento bíblico». Acentos y comillas no importan.
 * → {ids:[…], mensaje?} | null (si no es una referencia: búsqueda normal)
 */
export function resolverReferencia(consulta, piezas) {
  const q = comparable(consulta);
  if (!q) return null;
  // 1. Fechas de Logos
  const f = fechaDe(consulta);
  if (f) {
    const ids = piezas.filter(p => p.fecha === f).map(p => p.id);
    return ids.length ? { ids } : { ids: [], mensaje: `No hay entrada de Logos con fecha ${fechaLarga(f)}.` };
  }
  // 2. Nombre de bloque (completo o su primera palabra), solo o al inicio
  const bloques = [...new Set(piezas.map(p => p.bloque))];
  let bloque = null, resto = q;
  for (const b of bloques) {
    const nb = comparable(b), clave = nb.split(' ')[0];
    for (const k of [nb, clave]) {
      if (q === k) { bloque = b; resto = ''; break; }
      if (q.startsWith(k + ' ') && (!bloque || k.length > 0)) { bloque = b; resto = q.slice(k.length + 1).trim(); break; }
    }
    if (bloque) break;
  }
  const delBloque = bloque ? piezas.filter(p => p.bloque === bloque) : piezas;
  if (bloque && !resto) {
    const ids = delBloque.slice(0, 5).map(p => p.id);
    return { ids, mensaje: delBloque.length > 5 ? `${tituloCaso(bloque)}: ${delBloque.length} piezas. Ábrelas todas desde ☰ Índice.` : undefined };
  }
  // 3. Títulos de capítulo, sección o crónica
  const titulos = p => [p.seccion, p.capitulo, ...(p.capitulo ? p.capitulo.split(/(?=[“"«])/) : [])].filter(Boolean).map(comparable);
  let cand = delBloque.filter(p => titulos(p).includes(resto));
  if (!cand.length && resto.split(' ').length >= 2)
    cand = delBloque.filter(p => titulos(p).some(t => (' ' + t + ' ').includes(' ' + resto + ' ')));
  // Un título de capítulo cubre todas sus piezas: se prefiere la primera de cada capítulo
  if (cand.length > 1 && cand.every(p => p.capitulo && comparable(p.capitulo).includes(resto) && !comparable(p.seccion || '').includes(resto))) {
    const vistos = new Set(); cand = cand.filter(p => !vistos.has(p.grupo) && vistos.add(p.grupo));
  }
  if (cand.length) return { ids: cand.slice(0, 5).map(p => p.id) };
  return null;
}

/* ---------- Índice: árbol Bloque → Capítulo → Sección ---------- */
export function arbolIndice(piezas) {
  const raiz = [];
  const hijo = (lista, tipo, titulo) => {
    let n = lista.find(x => x.tipo === tipo && x.titulo === titulo);
    if (!n) { n = { tipo, titulo, hijos: [] }; lista.push(n); }
    return n;
  };
  for (const p of piezas) {
    const b = hijo(raiz, 'bloque', p.bloque);
    let cont = b;
    if (p.parte) cont = hijo(cont.hijos, 'parte', p.parte);
    if (p.nivelPieza === 'bloque' || (p.nivelPieza === 'parte' && !p.capitulo)) { (p.nivelPieza === 'bloque' ? b : cont).id ??= p.id; continue; }
    if (p.capitulo) {
      cont = hijo(cont.hijos, 'capitulo', p.capitulo);
      if (p.nivelPieza === 'capitulo') { cont.id = p.id; cont.etiquetas = p.etiquetas; continue; }
    }
    cont.hijos.push({ tipo: 'seccion', titulo: p.seccion, id: p.id, fecha: p.fecha });
  }
  return raiz;
}
