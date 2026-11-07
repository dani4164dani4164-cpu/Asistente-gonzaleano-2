/* ============================================================
   Lectura del .docx en el dispositivo: JSZip + DOMParser sobre
   word/document.xml. El nivel de cada párrafo se obtiene del
   NOMBRE del estilo en word/styles.xml («heading 1», «heading 2»),
   nunca del styleId, que cambia según el idioma de Word
   (p. ej. «Ttulo1» en español).
   Nada sale del dispositivo.
   ============================================================ */

/* JSZip llega por el import map (jsDelivr, versión fija). Si ese módulo
   no carga, se usa la versión clásica del mismo paquete y versión. */
const URL_JSZIP_CLASICO = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
let jszip = null;
async function cargarJSZip() {
  if (jszip) return jszip;
  try {
    const m = await import('jszip');
    jszip = m.default || m.JSZip || m;
    if (typeof jszip.loadAsync !== 'function') throw new Error('JSZip ESM sin loadAsync');
  } catch (e) {
    console.warn('JSZip (ESM) no cargó; uso la versión clásica.', e);
    await new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = URL_JSZIP_CLASICO; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar JSZip'));
      document.head.append(s);
    });
    jszip = window.JSZip;
  }
  return jszip;
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export class ErrorDocumento extends Error {
  constructor(mensaje, codigo) { super(mensaje); this.codigo = codigo; }
}

/** Nombre normalizado del estilo → nivel de título (1, 2…) o 0. */
function nivelPorNombre(nombre) {
  const m = /^(?:heading|t[ií]tulo|encabezado)\s*(\d)$/i.exec((nombre || '').trim());
  return m ? +m[1] : 0;
}

/* Propiedades de formato que importan para reconocer títulos por su aspecto. */
const hijoW = (el, tag) => { if (!el) return null; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === tag) return c; return null; };
const valW = el => el ? el.getAttributeNS(W, 'val') : null;
/** w:b / w:bCs: presente sin valor = activo; val="0"/"false"/"off" = inactivo. */
function leerBool(el) {
  if (!el) return null;
  const v = valW(el);
  return !(v === '0' || v === 'false' || v === 'off' || v === 'none');
}
function leerRPr(rPr) {
  if (!rPr) return {};
  const sz = valW(hijoW(rPr, 'sz'));
  return { sz: sz != null && sz !== '' ? +sz : null, b: leerBool(hijoW(rPr, 'b')) };
}

function leerEstilos(xml) {
  const estilos = new Map();     // styleId (párrafo) → {nombre, nivel, sz, b, jc, lista}
  const carEstilos = new Map();  // styleId (carácter) → {sz, b}
  let porDefecto = null, base = { sz: 22, b: false };
  if (!xml) return { estilos, carEstilos, porDefecto, base };
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const dd = doc.getElementsByTagNameNS(W, 'rPrDefault')[0];
  if (dd) { const r = leerRPr(hijoW(dd, 'rPr')); if (r.sz) base.sz = r.sz; if (r.b != null) base.b = r.b; }
  const crudos = new Map(), crudosCar = new Map();
  for (const st of doc.getElementsByTagNameNS(W, 'style')) {
    const tipo = st.getAttributeNS(W, 'type');
    const id = st.getAttributeNS(W, 'styleId');
    const nombre = valW(hijoW(st, 'name')) || id;
    const basado = valW(hijoW(st, 'basedOn'));
    const r = leerRPr(hijoW(st, 'rPr'));
    if (tipo === 'character') { crudosCar.set(id, { basado, ...r }); continue; }
    if (tipo !== 'paragraph') continue;
    const pPr = hijoW(st, 'pPr');
    crudos.set(id, { nombre, basado, ...r, jc: valW(hijoW(pPr, 'jc')), lista: hijoW(pPr, 'numPr') ? true : null });
    if (st.getAttributeNS(W, 'default') === '1' || st.getAttributeNS(W, 'default') === 'true') porDefecto = id;
  }
  // Hereda por basedOn: lo que el estilo no define lo toma de su padre.
  const heredar = (mapa, id, campo, prof = 0) => {
    const c = mapa.get(id);
    if (!c || prof > 12) return null;
    if (c[campo] != null) return c[campo];
    return c.basado ? heredar(mapa, c.basado, campo, prof + 1) : null;
  };
  const nivel = (id, prof = 0) => {
    const c = crudos.get(id);
    if (!c || prof > 12) return 0;
    return nivelPorNombre(c.nombre) || (c.basado ? nivel(c.basado, prof + 1) : 0);
  };
  for (const [id, c] of crudos) estilos.set(id, {
    nombre: c.nombre.toLowerCase(), nivel: nivel(id),
    sz: heredar(crudos, id, 'sz'), b: heredar(crudos, id, 'b'), jc: heredar(crudos, id, 'jc'), lista: !!heredar(crudos, id, 'lista'),
  });
  for (const [id] of crudosCar) carEstilos.set(id, { sz: heredar(crudosCar, id, 'sz'), b: heredar(crudosCar, id, 'b') });
  return { estilos, carEstilos, porDefecto, base };
}

/* Texto y formato de un párrafo: w:t, tabulaciones y saltos; sin texto
   borrado (control de cambios), sin códigos de campo y sin la copia de
   compatibilidad (mc:Fallback).
   Formato: tamaño máximo (medios puntos) y si TODO el texto va en negrita,
   tomando de cada run su w:sz/w:b, o si no, el de su estilo de carácter,
   el del estilo del párrafo o el predeterminado del documento. */
const SALTAR = new Set(['pPr', 'rPr', 'del', 'delText', 'instrText', 'Fallback', 'p', 'footnoteReference', 'commentReference']);
function leerParrafo(p, est, carEstilos, base) {
  let out = '', tam = 0, negrita = true, conTexto = false;
  const parSz = est?.sz ?? base.sz, parB = est?.b ?? base.b;
  const recorrer = (nodo, rf) => {
    for (let n = nodo.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      const ln = n.localName;
      if (SALTAR.has(ln)) continue;
      if (ln === 'r') {
        const rPr = hijoW(n, 'rPr'), r = leerRPr(rPr), ce = carEstilos.get(valW(hijoW(rPr, 'rStyle'))) || {};
        recorrer(n, { sz: r.sz ?? ce.sz ?? parSz, b: r.b ?? ce.b ?? parB });
      } else if (ln === 't' && n.namespaceURI === W) {
        const t = n.textContent;
        out += t;
        if (/\S/.test(t)) { conTexto = true; const f = rf || { sz: parSz, b: parB }; tam = Math.max(tam, f.sz || 0); if (!f.b) negrita = false; }
      }
      else if (ln === 'tab' && n.namespaceURI === W) out += '\t';
      else if ((ln === 'br' || ln === 'cr') && n.namespaceURI === W) out += '\n';
      else if (ln === 'noBreakHyphen') out += '-';
      else if (n.firstChild) recorrer(n, rf);
    }
  };
  recorrer(p, null);
  return { texto: out, tam: conTexto ? tam : parSz, negrita: conTexto && negrita };
}

const esperar = () => new Promise(r => setTimeout(r, 0));

/**
 * Lee un .docx (ArrayBuffer) y devuelve sus párrafos en orden:
 *   [{nivel: 0|1|2…, estilo: 'heading 1', texto,
 *     tam: medios puntos (w:sz efectivo, el mayor del párrafo),
 *     negrita: todo el texto en negrita, alin: 'center'|'both'|'left'…,
 *     lista: tiene viñeta o número (numPr)}]
 * El analizador de cada colección decide qué usa: Lecturas, los estilos;
 * la Doctrina, el formato visual.
 * Trabaja por lotes cediendo el control para no congelar la interfaz.
 */
export async function leerDocx(buffer, alAvanzar = () => {}) {
  const JSZip = await cargarJSZip();
  let zip;
  try { zip = await JSZip.loadAsync(buffer); }
  catch { throw new ErrorDocumento('El archivo no es un .docx válido.', 'no-docx'); }
  const docXml = zip.file('word/document.xml');
  if (!docXml) throw new ErrorDocumento('El archivo no es un documento de Word (.docx): no contiene word/document.xml.', 'no-docx');
  alAvanzar(0.05);
  const [xml, xmlEstilos] = await Promise.all([docXml.async('string'), zip.file('word/styles.xml')?.async('string')]);
  alAvanzar(0.15);
  await esperar();
  const { estilos, carEstilos, porDefecto, base } = leerEstilos(xmlEstilos);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length)
    throw new ErrorDocumento('El documento está dañado: su XML no se puede leer.', 'xml');
  const cuerpo = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!cuerpo) throw new ErrorDocumento('El documento no tiene cuerpo de texto.', 'xml');
  alAvanzar(0.3);
  await esperar();

  const ps = cuerpo.getElementsByTagNameNS(W, 'p');
  const total = ps.length, out = new Array(total);
  let t0 = performance.now();
  for (let i = 0; i < total; i++) {
    const p = ps[i];
    const pPr = p.firstElementChild?.localName === 'pPr' ? p.firstElementChild : null;
    const id = valW(hijoW(pPr, 'pStyle'));
    const est = estilos.get(id ?? porDefecto) || { nombre: (id || 'normal').toLowerCase(), nivel: 0 };
    const f = leerParrafo(p, est, carEstilos, base);
    out[i] = {
      nivel: est.nivel, estilo: est.nombre, texto: f.texto,
      tam: f.tam, negrita: f.negrita,
      alin: valW(hijoW(pPr, 'jc')) || est.jc || 'left',
      lista: !!hijoW(pPr, 'numPr') || !!est.lista,
    };
    if (performance.now() - t0 > 30) {           // cede ~cada 30 ms
      alAvanzar(0.3 + 0.7 * (i / total));
      await esperar();
      t0 = performance.now();
    }
  }
  alAvanzar(1);
  return out;
}
