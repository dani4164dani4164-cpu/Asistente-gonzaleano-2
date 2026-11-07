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

function leerEstilos(xml) {
  const estilos = new Map();     // styleId → {nombre, nivel}
  let porDefecto = null;
  if (!xml) return { estilos, porDefecto };
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const crudos = new Map();
  for (const st of doc.getElementsByTagNameNS(W, 'style')) {
    if (st.getAttributeNS(W, 'type') !== 'paragraph') continue;
    const id = st.getAttributeNS(W, 'styleId');
    const hijo = tag => [...st.childNodes].find(n => n.localName === tag && n.namespaceURI === W);
    const nombre = hijo('name')?.getAttributeNS(W, 'val') || id;
    const basado = hijo('basedOn')?.getAttributeNS(W, 'val') || null;
    const pPr = hijo('pPr');
    const ol = pPr && [...pPr.childNodes].find(n => n.localName === 'outlineLvl');
    const outline = ol ? +ol.getAttributeNS(W, 'val') : null;
    crudos.set(id, { nombre, basado, outline });
    if (st.getAttributeNS(W, 'default') === '1' || st.getAttributeNS(W, 'default') === 'true') porDefecto = id;
  }
  const resolver = (id, prof = 0) => {
    const c = crudos.get(id);
    if (!c || prof > 12) return 0;
    const n = nivelPorNombre(c.nombre);
    if (n) return n;
    if (c.basado) return resolver(c.basado, prof + 1);
    return 0;
  };
  for (const [id, c] of crudos) estilos.set(id, { nombre: c.nombre.toLowerCase(), nivel: resolver(id) });
  return { estilos, porDefecto };
}

/* Texto de un párrafo: w:t, tabulaciones y saltos; sin texto borrado
   (control de cambios), sin códigos de campo y sin la copia de
   compatibilidad (mc:Fallback). */
const SALTAR = new Set(['pPr', 'rPr', 'del', 'delText', 'instrText', 'Fallback', 'p', 'footnoteReference', 'commentReference']);
function textoDe(p) {
  let out = '';
  const recorrer = nodo => {
    for (let n = nodo.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      const ln = n.localName;
      if (SALTAR.has(ln)) continue;
      if (ln === 't' && n.namespaceURI === W) out += n.textContent;
      else if (ln === 'tab' && n.namespaceURI === W) out += '\t';
      else if ((ln === 'br' || ln === 'cr') && n.namespaceURI === W) out += '\n';
      else if (ln === 'noBreakHyphen') out += '-';
      else if (n.firstChild) recorrer(n);
    }
  };
  recorrer(p);
  return out;
}

const esperar = () => new Promise(r => setTimeout(r, 0));

/**
 * Lee un .docx (ArrayBuffer) y devuelve sus párrafos en orden:
 *   [{nivel: 0|1|2…, estilo: 'heading 1', texto}]
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
  const { estilos, porDefecto } = leerEstilos(xmlEstilos);
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
    let id = null;
    const pPr = p.firstElementChild?.localName === 'pPr' ? p.firstElementChild : null;
    if (pPr) for (let c = pPr.firstElementChild; c; c = c.nextElementSibling) if (c.localName === 'pStyle') { id = c.getAttributeNS(W, 'val'); break; }
    const est = estilos.get(id ?? porDefecto) || { nombre: (id || 'normal').toLowerCase(), nivel: 0 };
    out[i] = { nivel: est.nivel, estilo: est.nombre, texto: textoDe(p) };
    if (performance.now() - t0 > 30) {           // cede ~cada 30 ms
      alAvanzar(0.3 + 0.7 * (i / total));
      await esperar();
      t0 = performance.now();
    }
  }
  alAvanzar(1);
  return out;
}
