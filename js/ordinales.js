/* ============================================================
   Ordinales en español ⇄ número.
   Acepta femenino y masculino (primera/primer/primero, tercera/tercer),
   con o sin acentos, mayúsculas, espacios o guiones, las dos formas de
   11 y 12 (décima primera / undécima, décima segunda / duodécima) y la
   forma unida (decimoprimero, vigesimotercero…).
   Cubre de 1 a 999: unidades, decenas (décimo…nonagésimo) y centenas
   (centésimo, ducentésimo, tricentésimo, cuadringentésimo, quingentésimo,
   sexcentésimo, septingentésimo, octingentésimo, noningentésimo).
   ============================================================ */

const CENTENAS = [
  ['centesim', 100], ['ducentesim', 200], ['tricentesim', 300],
  ['cuadringentesim', 400], ['quadringentesim', 400], ['quingentesim', 500],
  ['sexcentesim', 600], ['septingentesim', 700], ['setingentesim', 700],
  ['octingentesim', 800], ['noningentesim', 900], ['nongentesim', 900],
];
const DECENAS = [
  ['decim', 10], ['vigesim', 20], ['trigesim', 30], ['cuadragesim', 40],
  ['quincuagesim', 50], ['sexagesim', 60], ['septuagesim', 70], ['setuagesim', 70],
  ['octogesim', 80], ['nonagesim', 90],
];
const ESPECIALES = [['undecim', 11], ['duodecim', 12]];
const UNIDADES = [
  ['primer', 1], ['segund', 2], ['tercer', 3], ['cuart', 4], ['quint', 5],
  ['sext', 6], ['septim', 7], ['setim', 7], ['octav', 8], ['noven', 9], ['non', 9],
];

const valor = Object.fromEntries([...CENTENAS, ...DECENAS, ...ESPECIALES, ...UNIDADES]);
// Las raíces más largas primero para que la alternancia no se quede con un prefijo.
const alt = lista => lista.map(([r]) => r).sort((a, b) => b.length - a.length).join('|');
const RE = new RegExp(
  `^(?:(${alt(CENTENAS)})[oa]?)?` +
  `(?:(${alt(DECENAS)})[oa]?(?:(${alt(UNIDADES)})[oa]?)?|(${alt(ESPECIALES)})[oa]?|(${alt(UNIDADES)})[oa]?)?$`
);

const sinAcentos = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "Ducentésima Quincuagésima Primera" → 251 · si no es un ordinal → null */
export function ordinalANumero(texto) {
  const s = sinAcentos(String(texto ?? '')).toLowerCase().replace(/[\s\-‐–_.]+/g, '');
  if (!s) return null;
  const m = RE.exec(s);
  if (!m) return null;
  const [, c, d, ud, e, u] = m;
  if (!c && !d && !e && !u) return null;
  return (c ? valor[c] : 0) + (d ? valor[d] : 0) + (ud ? valor[ud] : 0) + (e ? valor[e] : 0) + (u ? valor[u] : 0);
}

/* ---------- Número → ordinal (para generar documentos de prueba y validar) ---------- */
const N_CENT = ['', 'centésim', 'ducentésim', 'tricentésim', 'cuadringentésim', 'quingentésim', 'sexcentésim', 'septingentésim', 'octingentésim', 'noningentésim'];
const N_DEC = ['', 'décim', 'vigésim', 'trigésim', 'cuadragésim', 'quincuagésim', 'sexagésim', 'septuagésim', 'octogésim', 'nonagésim'];
const N_UNI = ['', 'primer', 'segund', 'tercer', 'cuart', 'quint', 'sext', 'séptim', 'octav', 'noven'];

/**
 * numeroAOrdinal(251, {genero:'f'}) → "Ducentésima Quincuagésima Primera"
 * opciones:
 *   genero   'f' | 'm'
 *   apocope  true → "Primer"/"Tercer" al final en masculino (Primer Santo Salmo)
 *   once     'compuesta' (Décima Primera) | 'simple' (Undécima, Duodécima)
 */
export function numeroAOrdinal(n, { genero = 'f', apocope = true, once = 'simple' } = {}) {
  if (!Number.isInteger(n) || n < 1 || n > 999) throw new RangeError('Fuera de rango: ' + n);
  const fin = genero === 'f' ? 'a' : 'o';
  const raices = [];
  const c = Math.floor(n / 100), d = Math.floor((n % 100) / 10), u = n % 10;
  if (c) raices.push(N_CENT[c]);
  if (d === 1 && (u === 1 || u === 2) && once === 'simple') raices.push(u === 1 ? 'undécim' : 'duodécim');
  else {
    if (d) raices.push(N_DEC[d]);
    if (u) raices.push(N_UNI[u]);
  }
  return raices.map((r, i) => {
    const ultima = i === raices.length - 1;
    const sinFinal = ultima && genero === 'm' && apocope && (r === 'primer' || r === 'tercer');
    const palabra = sinFinal ? r : r + fin;
    return palabra[0].toUpperCase() + palabra.slice(1);
  }).join(' ');
}
