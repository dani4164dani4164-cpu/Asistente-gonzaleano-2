/* ============================================================
   Utilidades de texto (sin dependencias; sirven en la página,
   en el Worker y en las pruebas).
   ============================================================ */

const MARCAS_DIACRITICAS = /[̀-ͯ]/g;

/** Minúsculas, sin acentos, espacios colapsados. */
export function normalizarSimple(s) {
  return String(s ?? '')
    .normalize('NFD').replace(MARCAS_DIACRITICAS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Espacios sobrantes fuera y un solo espacio dentro (conserva acentos y mayúsculas). */
export function limpiarEspacios(s) {
  return String(s ?? '').replace(/[\s ​]+/g, ' ').trim();
}

const ES_LETRA = /[\p{L}\p{N}]/u;

/**
 * Normaliza para buscar sin importar acentos, mayúsculas ni puntuación,
 * y conserva un mapa de cada carácter normalizado a su posición original
 * (para poder resaltar en el texto real).
 *   → { texto: ' palabra palabra ', mapa: Int32Array }
 * El texto normalizado empieza y termina con un espacio, así las búsquedas
 * de palabra completa se hacen con indexOf(' x ').
 */
export function normalizarConMapa(s) {
  s = String(s ?? '');
  let out = ' ';
  const mapa = [0];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let n = c.normalize('NFD').replace(MARCAS_DIACRITICAS, '').toLowerCase();
    if (!n) continue;                       // la letra era solo un acento suelto
    if (!ES_LETRA.test(n)) n = ' ';
    for (const ch of n) {
      if (ch === ' ' && out[out.length - 1] === ' ') continue;
      out += ch; mapa.push(i);
    }
  }
  if (out[out.length - 1] !== ' ') { out += ' '; mapa.push(s.length); }
  return { texto: out, mapa: Int32Array.from(mapa) };
}

/** Igual que normalizarConMapa pero solo el texto. */
export function normalizarBusqueda(s) {
  return normalizarConMapa(s).texto;
}

/** Palabras vacías del español (no cuentan para la búsqueda por palabras). */
export const PALABRAS_VACIAS = new Set((
  'a al algo algun alguna algunas alguno algunos ante antes aquel aquella aquellas aquellos aqui asi aun cada como con contra cual cuales cuando de del desde donde dos e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba estas este esto estos fue fueron ha habia han hasta hay la las le les lo los mas me mi mis mucho muy nada ni no nos nosotros o os otra otras otro otros para pero poco por porque que quien quienes se sea segun ser si sin sino sobre su sus tal tambien tan tanto te ti todo todos tu tus un una uno unos unas y ya yo ' +
  'dice dijo habla donde dime quiero busca buscar encuentra cual cuales sobre acerca'
).split(/\s+/).filter(Boolean));

/** Palabras con contenido de una consulta ya normalizada. */
export function palabrasClave(textoNormalizado) {
  const todas = textoNormalizado.split(' ').filter(Boolean);
  const clave = todas.filter(p => !PALABRAS_VACIAS.has(p) && p.length > 1);
  return clave.length ? clave : todas;
}

/** Frases de un párrafo con su posición: [{ini, fin, texto}] (sin partir ninguna). */
export function frasesConPosicion(texto) {
  const s = String(texto), out = [];
  const re = /[.!?;:]+["»”’)\]]*(\s+|$)/g;
  let ini = 0, m;
  while ((m = re.exec(s))) {
    const fin = m.index + m[0].length;
    if (fin === ini) { re.lastIndex++; continue; }
    out.push({ ini, fin });
    ini = fin;
    if (fin >= s.length) break;
  }
  if (ini < s.length) out.push({ ini, fin: s.length });
  return out
    .map(({ ini, fin }) => {
      const bruto = s.slice(ini, fin), lead = bruto.length - bruto.trimStart().length;
      const t = bruto.trim();
      return { ini: ini + lead, fin: ini + lead + t.length, texto: t };
    })
    .filter(f => f.texto);
}

/** Divide un párrafo en frases sin partirlas. */
export function dividirEnFrases(texto) {
  return frasesConPosicion(texto).map(f => f.texto);
}

export function contarPalabras(s) {
  const m = String(s).match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

/** Une números en rangos legibles: [1,2,3,5] → "1–3, 5". */
export function rangos(nums) {
  const v = [...new Set(nums)].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < v.length; i++) {
    let j = i;
    while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++;
    out.push(j > i ? `${v[i]}–${v[j]}` : `${v[i]}`);
    i = j;
  }
  return out.join(', ');
}

export function escaparHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Pinta `texto` con <mark> en los intervalos [ini, fin) dados (posiciones del texto original). */
export function resaltarHtml(texto, intervalos) {
  const iv = [...(intervalos || [])].sort((a, b) => a[0] - b[0]);
  let html = '', pos = 0;
  for (const [a0, b] of iv) {
    const a = Math.max(a0, pos);
    if (b <= a) continue;
    html += escaparHtml(texto.slice(pos, a)) + '<mark>' + escaparHtml(texto.slice(a, b)) + '</mark>';
    pos = b;
  }
  return html + escaparHtml(texto.slice(pos));
}
