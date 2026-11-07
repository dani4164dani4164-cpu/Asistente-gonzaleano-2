/* ============================================================
   Analizador «lecturas»: Lecturas, Salmos y Evangelios Gonzaleanos.

   Recibe los párrafos del .docx ya leídos ({nivel, estilo, texto};
   nivel 1 = heading 1, 2 = heading 2, 0 = texto normal) y devuelve
   las piezas encontradas y el informe «Estructura detectada».
   No redacta ni interpreta nada: solo reparte el texto real del
   documento en piezas.

   Todo analizador expone la misma forma (ver README, «Agregar una
   colección»): id, TIPOS, analizar(), esMarca(), parsearReferencia(),
   etiqueta().
   ============================================================ */
import { ordinalANumero } from '../ordinales.js';
import { normalizarSimple, limpiarEspacios, rangos, contarPalabras } from '../texto.js';

export const id = 'lecturas';

/** Tipos de pieza, en el orden en que aparecen dentro de un conjunto. */
export const TIPOS = {
  lectura:   { nombre: 'Santa Lectura',   abrev: 'Lect. Gonz.',  corto: 'Lectura',   orden: 0 },
  salmo:     { nombre: 'Santo Salmo',     abrev: 'Salmo Gonz.',  corto: 'Salmo',     orden: 1 },
  evangelio: { nombre: 'Santo Evangelio', abrev: 'Evang. Gonz.', corto: 'Evangelio', orden: 2 },
};
export const NOMBRE_GRUPO = 'conjunto';

/* ---------- Encabezados ---------- */
const RE_PIEZA = /^(.+?) sant[oa] (lectura|salmo|evangelio)\b ?(.*)$/;

/** Reconoce un encabezado. → {tipo, numero, apellido} | {tipo:'introduccion'} | null */
export function reconocerEncabezado(texto) {
  const original = limpiarEspacios(texto).replace(/[.:;,]+$/, '');
  const n = normalizarSimple(original);
  if (!n) return null;
  if (/^introduccion\b/.test(n)) return { tipo: 'introduccion' };
  const m = RE_PIEZA.exec(n);
  if (!m) return null;
  const numero = ordinalANumero(m[1]);
  if (!numero) return null;
  // El apellido («de Súplica», «Penitencial», «de Jesucristo») se toma del texto
  // original para conservar acentos y mayúsculas: misma cantidad de palabras.
  const palabras = original.split(' ');
  const antes = (m[1] + ' x ' + m[2]).split(' ').length;
  const apellido = m[3] ? palabras.slice(antes).join(' ') : '';
  return { tipo: m[2], numero, apellido };
}

/* ---------- Marcas frecuentes dentro del texto ---------- */
const MARCAS = [
  ['autor',     /^escrit[oa] por el profeta\b/],
  ['cierre',    /^palabras? del mismo senor\b/],
  ['canto',     /^canto\b[.:]?$/],
  ['respuesta', /^todos\s*:/],
  ['aleluya',   /^aleluya[\s,.!¡]*aleluya\b/],
];
/** ¿Qué marca es este párrafo? → 'autor' | 'cierre' | 'canto' | 'respuesta' | 'aleluya' | null */
export function tipoDeMarca(texto) {
  const n = normalizarSimple(texto).replace(/^[¡!"“«\s]+/, '');
  for (const [nombre, re] of MARCAS) if (re.test(n)) return nombre;
  return null;
}
/** Las marcas se muestran en el texto completo pero no entran en la búsqueda por significado. */
export const esMarca = texto => tipoDeMarca(texto) !== null;

/* ---------- Análisis del documento ---------- */
export function analizar(parrafos) {
  const piezas = [];
  const noReconocidos = [];
  const fueraDeOrden = [];
  const sinEstilo = [];        // párrafos normales que parecen títulos
  let actual = null;           // pieza que está recibiendo texto
  let conjunto = null;         // número de la última Santa Lectura vista
  let previo = null;           // texto de antes de cualquier encabezado
  let totalPalabras = 0;

  const ref = p => p.tipo === 'introduccion' ? 'Introducción' : `${TIPOS[p.tipo].abrev} ${p.numero}`;

  parrafos.forEach((p, i) => {
    const texto = limpiarEspacios(p.texto);
    if (p.nivel === 1 || p.nivel === 2) {
      if (!texto) return;
      const r = reconocerEncabezado(texto);
      if (r && r.tipo === 'introduccion') {
        actual = { tipo: 'introduccion', numero: 0, grupo: 0, titulo: texto, apellido: '', parrafos: [], posicion: i };
        piezas.push(actual);
        return;
      }
      if (r) {
        if (r.tipo === 'lectura') {
          const ultimo = conjunto;
          conjunto = r.numero;
          if (ultimo !== null && r.numero !== ultimo + 1)
            fueraDeOrden.push(r.numero <= ultimo
              ? `La ${TIPOS.lectura.nombre} ${r.numero} aparece después de la ${ultimo}`
              : `Después de la ${TIPOS.lectura.nombre} ${ultimo} sigue la ${r.numero}`);
        } else if (conjunto === null) {
          fueraDeOrden.push(`El ${TIPOS[r.tipo].nombre} ${r.numero} aparece antes de cualquier ${TIPOS.lectura.nombre}`);
        } else if (r.numero !== conjunto) {
          fueraDeOrden.push(`El ${TIPOS[r.tipo].nombre} ${r.numero} está dentro del conjunto ${conjunto}`);
        }
        actual = {
          tipo: r.tipo, numero: r.numero, grupo: r.numero, apellido: r.apellido,
          titulo: texto, parrafos: [], posicion: i, nivel: p.nivel,
        };
        piezas.push(actual);
        return;
      }
      // Encabezado que no es una pieza: se informa y su texto se conserva
      // dentro de la pieza en curso, para que nada se pierda.
      noReconocidos.push({ texto, nivel: p.nivel, despuesDe: actual ? ref(actual) : 'inicio del documento' });
      if (actual) actual.parrafos.push(texto);
      return;
    }
    if (!texto) return;
    if (texto.length < 90) {
      const r = reconocerEncabezado(texto);
      if (r && r.tipo !== 'introduccion') sinEstilo.push({ texto, despuesDe: actual ? ref(actual) : 'inicio del documento' });
    }
    totalPalabras += contarPalabras(texto);
    if (actual) actual.parrafos.push(texto);
    else (previo ??= []).push(texto);
  });

  // Metadatos tomados de las marcas
  for (const pz of piezas) {
    for (const t of pz.parrafos) {
      const m = tipoDeMarca(t);
      if (m === 'autor' && !pz.autor) pz.autor = t;
      if (m === 'cierre') pz.cierre = t;
    }
  }

  // Repetidos: la primera conserva el número; las demás quedan marcadas.
  const vistos = new Map(), repetidos = new Map();
  for (const pz of piezas) {
    if (pz.tipo === 'introduccion') { pz.clave = 'introduccion'; continue; }
    const k = `${pz.tipo}:${pz.numero}`;
    const veces = (vistos.get(k) || 0) + 1;
    vistos.set(k, veces);
    pz.clave = veces === 1 ? k : `${k}~${veces}`;
    if (veces > 1) { pz.repetida = veces; repetidos.set(k, veces); }
  }

  return { piezas, informe: informe(piezas, { noReconocidos, sinEstilo, fueraDeOrden, repetidos, previo, totalParrafos: parrafos.length, totalPalabras }) };
}

function informe(piezas, { noReconocidos, sinEstilo, fueraDeOrden, repetidos, previo, totalParrafos, totalPalabras }) {
  const reales = piezas.filter(p => p.tipo !== 'introduccion' && !p.repetida);
  const por = t => reales.filter(p => p.tipo === t).map(p => p.numero);
  const lect = por('lectura'), sal = por('salmo'), ev = por('evangelio');
  const conjuntos = new Set(reales.map(p => p.numero));
  const max = conjuntos.size ? Math.max(...conjuntos) : 0;
  const falta = lista => { const s = new Set(lista); const f = []; for (let n = 1; n <= max; n++) if (!s.has(n) && conjuntos.has(n)) f.push(n); return f; };
  const sinConjunto = []; for (let n = 1; n <= max; n++) if (!conjuntos.has(n)) sinConjunto.push(n);
  const faltaLect = falta(lect), faltaSal = falta(sal), faltaEv = falta(ev);
  const intro = piezas.find(p => p.tipo === 'introduccion');

  const datos = {
    conjuntos: conjuntos.size, lecturas: lect.length, salmos: sal.length, evangelios: ev.length,
    maximo: max, introduccion: !!intro,
    faltantes: { conjuntos: sinConjunto, lecturas: faltaLect, salmos: faltaSal, evangelios: faltaEv },
    repetidos: [...repetidos].map(([k, veces]) => ({ tipo: k.split(':')[0], numero: +k.split(':')[1], veces })),
    fueraDeOrden, noReconocidos, sinEstilo,
    parrafos: totalParrafos, palabras: totalPalabras,
    textoSinEncabezado: previo ? previo.length : 0,
  };

  const avisos = [];
  const etq = t => TIPOS[t].nombre;
  if (sinConjunto.length) avisos.push({ titulo: 'Números de conjunto que no aparecen', items: [rangos(sinConjunto)] });
  if (faltaLect.length) avisos.push({ titulo: `Conjuntos sin ${etq('lectura')}`, items: [rangos(faltaLect)] });
  if (faltaSal.length) avisos.push({ titulo: `Conjuntos sin ${etq('salmo')}`, items: [rangos(faltaSal)] });
  if (faltaEv.length) avisos.push({ titulo: `Conjuntos sin ${etq('evangelio')}`, items: [`${rangos(faltaEv)} (${faltaEv.length})`] });
  if (datos.repetidos.length) avisos.push({ titulo: 'Números repetidos', items: datos.repetidos.map(r => `${TIPOS[r.tipo].abrev} ${r.numero}: aparece ${r.veces} veces`) });
  if (fueraDeOrden.length) avisos.push({ titulo: 'Fuera de orden', items: fueraDeOrden });
  if (noReconocidos.length) avisos.push({ titulo: 'Encabezados que no se reconocieron', items: noReconocidos.map(r => `«${r.texto}» (título ${r.nivel}, después de ${r.despuesDe})`) });
  if (sinEstilo.length) avisos.push({ titulo: 'Párrafos que parecen títulos pero tienen estilo de texto normal (se leyeron como texto)', items: sinEstilo.map(r => `«${r.texto}» (después de ${r.despuesDe})`) });
  if (previo) avisos.push({ titulo: 'Texto antes del primer encabezado', items: [`${previo.length} párrafo(s) sin encabezado; no se cuentan como pieza`] });

  const muestra = [];
  const listaConj = [...conjuntos].sort((a, b) => a - b);
  for (const n of [listaConj[0], listaConj[listaConj.length - 1]]) {
    if (n === undefined || muestra.some(m => m.numero === n)) continue;
    const pzs = reales.filter(p => p.numero === n).sort((a, b) => TIPOS[a.tipo].orden - TIPOS[b.tipo].orden);
    muestra.push({
      numero: n,
      titulo: `Conjunto ${n}`,
      lineas: pzs.map(p => ({ ref: `${TIPOS[p.tipo].abrev} ${p.numero}`, titulo: p.titulo, inicio: primerTexto(p) })),
    });
  }

  const ok = reales.length > 0;
  return {
    ok,
    mensaje: ok ? '' :
      'No se reconoció ninguna Santa Lectura, Santo Salmo ni Santo Evangelio. ' +
      'Revisa que el documento sea el de Lecturas y Evangelios y que cada título use el estilo ' +
      '«Título 1» (Santa Lectura) o «Título 2» (Santo Salmo, Santo Evangelio), con el número escrito en palabras.',
    resumen: [
      { etiqueta: 'Conjuntos', valor: datos.conjuntos },
      { etiqueta: 'Santas Lecturas', valor: datos.lecturas },
      { etiqueta: 'Santos Salmos', valor: datos.salmos },
      { etiqueta: 'Santos Evangelios', valor: datos.evangelios },
      { etiqueta: 'Introducción', valor: intro ? 'sí' : 'no' },
      { etiqueta: 'Párrafos / palabras', valor: `${totalParrafos.toLocaleString('es')} / ${totalPalabras.toLocaleString('es')}` },
    ],
    avisos,
    muestra,
    datos,
  };
}

function primerTexto(p) {
  const t = p.parrafos.find(x => !esMarca(x)) || p.parrafos[0] || '';
  return t.length > 140 ? t.slice(0, 140).replace(/\s+\S*$/, '') + '…' : t;
}

/* ---------- Referencias que escribe el usuario ---------- */
const PALABRA_TIPO = {
  lectura: 'lectura', lecturas: 'lectura', lect: 'lectura', lec: 'lectura',
  salmo: 'salmo', salmos: 'salmo', sal: 'salmo', slm: 'salmo',
  evangelio: 'evangelio', evangelios: 'evangelio', evang: 'evangelio', ev: 'evangelio', evg: 'evangelio',
  conjunto: 'conjunto', conj: 'conjunto',
};
const RE_TIPO = '(lecturas?|lect|lec|salmos?|sal|slm|evangelios?|evang|evg|ev|conjunto|conj)';

/**
 * «Lect. Gonz. 145», «Evang. Gonz. 145», «Salmo Gonz. 87», «lectura 12»,
 * «evangelio 145», «salmo 87», «conjunto 300», «octava lectura»,
 * «Centésimo Primer Santo Salmo», «145», «introducción».
 * → {tipo: 'lectura'|'salmo'|'evangelio'|'conjunto'|'introduccion', numero} | null
 */
export function parsearReferencia(consulta) {
  let q = normalizarSimple(consulta)
    .replace(/[.,;:¿?¡!"«»“”()]/g, ' ')
    .replace(/\b(n(u|ú)m(ero)?|no|n°|nº|#)\s*(?=\d)/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/^(ver|abre|abrir|muestra|muestrame|mostrar|dame|leer|lee|busca|buscar|ir a|la|el)\s+/, '')
    .replace(/^(la|el)\s+/, '');
  if (!q) return null;
  if (/^introduccion$/.test(q)) return { tipo: 'introduccion', numero: 0 };
  let m;
  if ((m = /^(\d{1,4})$/.exec(q))) return { tipo: 'conjunto', numero: +m[1] };
  // «Lect. Gonz. 145», «lectura 12», «salmo gonzaleano 87», «santo evangelio 3»
  if ((m = new RegExp(`^(?:sant[oa] )?${RE_TIPO}(?: gonz(?:aleano|aleana)?)? (\\d{1,4})$`).exec(q)))
    return { tipo: PALABRA_TIPO[m[1]], numero: +m[2] };
  // «12 lectura», «12a lectura»
  if ((m = new RegExp(`^(\\d{1,4})(?:a|o|ª|º|er|ra|ro)? (?:sant[oa] )?${RE_TIPO}(?: gonz(?:aleano|aleana)?)?$`).exec(q)))
    return { tipo: PALABRA_TIPO[m[2]], numero: +m[1] };
  // «octava lectura», «centésimo primer santo salmo», «décimo sexto santo evangelio de jesucristo»
  if ((m = new RegExp(`^(.+?) (?:sant[oa] )?${RE_TIPO}(?: gonz(?:aleano|aleana)?)?(?: .*)?$`).exec(q))) {
    const n = ordinalANumero(m[1]);
    if (n) return { tipo: PALABRA_TIPO[m[2]], numero: n };
  }
  // «lectura octava», «conjunto trescientos» (solo ordinales)
  if ((m = new RegExp(`^${RE_TIPO} (.+)$`).exec(q))) {
    const n = ordinalANumero(m[2]);
    if (n) return { tipo: PALABRA_TIPO[m[1]], numero: n };
  }
  return null;
}

/** Cómo se muestra una pieza: {ref:'Lect. Gonz. 145', tipo:'Santa Lectura'} */
export function etiqueta(p) {
  if (p.tipo === 'introduccion') return { ref: 'Introducción', tipo: 'Sección aparte' };
  const t = TIPOS[p.tipo];
  return {
    ref: `${t.abrev} ${p.numero}${p.repetida ? ` (repetida ${p.repetida})` : ''}`,
    tipo: t.nombre + (p.apellido ? ' ' + p.apellido : ''),
  };
}
