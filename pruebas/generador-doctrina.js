/* ============================================================
   Generador del DOCUMENTO DE PRUEBA (FICTICIO) de la Doctrina
   Gonzaleana para Kyrien. Imita la ESTRUCTURA y el FORMATO del
   documento real (docs/KYRIEN.md, punto 2) con TEXTO INVENTADO:
     - 11 bloques reconocibles solo por su formato: tamaño ≥ 60 y
       centrado; unos con «heading 1» (ESTIGMAS, LOGOS sin negrita,
       CRÓNICAS), CATEQUESIS con «heading 2», el resto texto normal
     - capítulos en negrita y centrados (28–40), algunos de varias
       líneas, con «(PRIMERA COMUNIÓN)» / «(CONFIRMACIÓN)», y capítulos
       de Catequesis con «heading 1» que NO son bloques
     - partes de Gonzaleanología («PARTE I._ …»)
     - secciones: «…._», entre comillas (“ ” y " "), mayúsculas
       mezcladas («“El ELEGIDO”»), y fechas de Logos con «heading 3»
     - el Credo en negrita y justificado (no son secciones)
     - listas numeradas en negrita (no son títulos)
     - un título dudoso (negrita, centrado, 13 pt)
     - citas (Lect. Gonz. N), (Evang. Gonz. N), (Salmo Gonz. N) y
       (Palabra del Señor, fecha)
     - una crónica de más de 10,000 palabras
   El texto de cada pieza sale de una semilla propia, así que insertar
   piezas en medio NO cambia el texto de las demás (prueba de
   actualización incremental).
   Uso: generarDoctrina(JSZip, opciones) → Promise<Uint8Array>
   ============================================================ */
import { TEMAS } from './generador.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const semilla = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const NOMBRES_TEMAS = Object.keys(TEMAS);

/** Párrafos inventados (con frases de un tema) para una pieza. */
function cuerpo(clave, n = 3, tema = null, extra = []) {
  const r = rng(semilla(clave));
  const tm = tema || NOMBRES_TEMAS[semilla(clave) % NOMBRES_TEMAS.length];
  const out = [];
  for (let i = 0; i < n; i++) {
    const b = [...TEMAS[tm]];
    for (let k = b.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [b[k], b[j]] = [b[j], b[k]]; }
    out.push(b.slice(0, 3 + Math.floor(r() * 3)).join(' '));
  }
  extra.forEach(([i, t]) => { out[i] = out[i] + ' ' + t; });
  return out;
}

export const FRASE_UNICA_DOCTRINA = 'Y el farol del sacristán quedó encendido sobre la piedra del umbral hasta el amanecer.';

/* ---------- XML con formato ---------- */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function par(texto, { estilo = null, jc = 'both', sz = null, b = null, lista = false, partir = false } = {}) {
  const pPr = (estilo ? `<w:pStyle w:val="${estilo}"/>` : '') + (lista ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : '') + (jc ? `<w:jc w:val="${jc}"/>` : '');
  const rPr = (b === true ? '<w:b/><w:bCs/>' : b === false ? '<w:b w:val="0"/>' : '') + (sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : '');
  const run = t => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
  const runs = partir && texto.length > 10 ? run(texto.slice(0, Math.floor(texto.length / 2))) + run(texto.slice(Math.floor(texto.length / 2))) : run(texto);
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs}</w:p>`;
}
const vacio = () => '<w:p/>';
const bloque = (t, o = {}) => par(t, { jc: 'center', sz: 96, b: true, ...o });
const capitulo = (t, o = {}) => par(t, { jc: 'center', sz: 32, b: true, ...o });
const seccion = (t, o = {}) => par(t, { jc: 'both', sz: 24, b: true, ...o });
const texto = (t, o = {}) => par(t, { jc: 'both', ...o });

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="es-MX"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Ttulo2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Ttulo3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Prrafodelista"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;
const NUMERACION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;
const TIPOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

/* ---------- Contenido ---------- */
const LOGOS = [
  ['Lunes 7 de Agosto de 2017:', 'pastor'], ['Martes 3 de Octubre de 2017:', 'luz'], ['Domingo 7 de Enero de 2018:', 'agua'],
  ['Viernes 16 de Marzo de 2018:', 'pan'], ['Lunes 6 de Agosto de 2018:', 'monte'], ['Sábado 3 de Noviembre de 2018:', 'camino'],
  ['Miércoles 7 de Agosto de 2019:', 'sembrador'], ['Jueves 12 de Diciembre de 2019:', 'invierno'], ['Martes 25 de Agosto de 2020:', 'perdon'],
  ['Domingo 20 de Junio de 2021:', 'mar'], ['Sábado 20 de julio de 2024:', 'luz'], ['Sábado 20 de septiembre de 2025:', 'sanacion'],
];
const CRONICAS = [
  ['“Te fallé”', 'perdon'], ['"El regreso a casa"', 'camino'], ['“La barca del alba”', 'mar'], ['“El ELEGIDO”', 'monte'],
  ['“La noche más larga”', 'invierno', 'larga'], ['"El pozo del pueblo"', 'agua'], ['“Pan para todos”', 'pan'],
  ['“La oveja que volvió”', 'pastor'], ['“El sembrador de la colina”', 'sembrador'], ['“Una casa sobre la roca”', 'casa'],
];

/**
 * opciones:
 *   insertarCristologia  agrega una sección nueva a mitad de Cristología
 *   insertarCronica      agrega una crónica nueva a mitad de Crónicas
 *   modificarLogos       cambia un párrafo de una entrada de Logos
 *   renombrarCronica     cambia el título de una crónica sin tocar su texto
 *   sinBloques           solo texto normal (debe dar luz roja)
 */
export function construirDoctrina(op = {}) {
  const P = [];
  const add = (...xs) => P.push(...xs);
  const cuerpoP = (clave, n, tema, extra) => cuerpo(clave, n, tema, extra).forEach(t => add(texto(t)));

  if (op.sinBloques) {
    for (let i = 0; i < 30; i++) add(texto(cuerpo('sin' + i, 1)[0]));
    return P;
  }

  // 1. DOCTRINA GONZALEANA (preliminares)
  add(bloque('DOCTRINA GONZALEANA', { sz: 112 }), vacio());
  add(capitulo('INTRODUCCIÓN'));
  add(texto('Este es un DOCUMENTO FICTICIO DE PRUEBA para Kyrien. Todo su texto es inventado; solo imita la estructura y el formato del documento real.'));
  add(texto('La Doctrina se reúne en once bloques: Cristología Gonzaleana, Mariología Gonzaleana, Gonzaleanología, Estigmas, Catequesis Gonzaleana, Credo Gonzaleano, Teofanías, Logos, Crónicas y Novenarios, precedidos de estos preliminares.'));
  add(capitulo('PRÓLOGO'));
  cuerpoP('prel-prologo', 2);

  // 2. CRISTOLOGÍA GONZALEANA: 6 capítulos (texto normal, tamaño 96)
  add(vacio(), bloque('CRISTOLOGÍA GONZALEANA', { b: true, sz: 96 }));
  add(capitulo('NUESTRO SEÑOR JESUCRISTO'), capitulo('“EL HIJO DE DIOS”'));
  cuerpoP('crist-1', 2, 'luz', [[0, 'Así lo anuncia la Escritura (Lect. Gonz. 44) y lo confirma el Evangelio (Evang. Gonz. 12).']]);
  add(capitulo('EL VERBO ENCARNADO'));
  add(seccion('LA PROMESA._')); cuerpoP('crist-2-promesa', 2, 'sembrador');
  if (op.insertarCristologia) { add(seccion('LA ESPERA DE LOS PROFETAS._')); cuerpoP('crist-2-espera', 2, 'monte'); }
  add(seccion('EL CUMPLIMIENTO._')); cuerpoP('crist-2-cumplimiento', 2, 'pan', [[1, 'Como canta el salmista (Salmo Gonz. 87).']]);
  add(seccion('“LA HUMILDAD DEL PESEBRE”')); cuerpoP('crist-2-pesebre', 2, 'invierno');
  add(capitulo('EL BUEN PASTOR')); cuerpoP('crist-3', 3, 'pastor');
  add(capitulo('EL MAESTRO DE LA ORILLA')); cuerpoP('crist-4', 3, 'mar');
  add(capitulo('EL MÉDICO DE LAS ALMAS')); cuerpoP('crist-5', 3, 'sanacion');
  add(capitulo('LA PIEDRA ANGULAR')); cuerpoP('crist-6', 3, 'casa');

  // 3. MARIOLOGÍA GONZALEANA: 4 capítulos (y un título dudoso)
  add(vacio(), bloque('MARIOLOGÍA GONZALEANA', { sz: 96 }));
  add(capitulo('LA MADRE DEL SEÑOR')); cuerpoP('mario-1', 3, 'agua');
  add(capitulo('LA LLENA DE GRACIA')); cuerpoP('mario-2', 3, 'luz');
  add(par('ORACIÓN FINAL', { jc: 'center', sz: 26, b: true }));              // dudoso: grande en negrita pero 13 pt
  cuerpoP('mario-2b', 1, 'monte');
  add(capitulo('LA VIRGEN DEL CAMINO')); cuerpoP('mario-3', 3, 'camino');
  add(capitulo('LA REINA DEL CIELO')); cuerpoP('mario-4', 3, 'luz');

  // 4. GONZALEANOLOGÍA (72): Parte I y Parte II, 6 capítulos, 18 secciones en Parte II
  add(vacio(), bloque('GONZALEANOLOGÍA', { sz: 72 }));
  add(par('PARTE I._ “ENSEÑANZA HISTÓRICA”', { jc: 'center', sz: 34, b: true }));
  add(capitulo('EL ORIGEN')); cuerpoP('gonz-1', 2, 'camino');
  add(capitulo('LOS PRIMEROS AÑOS')); cuerpoP('gonz-2', 2, 'casa');
  add(capitulo('LA MISIÓN')); cuerpoP('gonz-3', 2, 'sembrador');
  add(par('PARTE II._ “ENSEÑANZA CRONOLÓGICA”', { jc: 'center', sz: 34, b: true }));
  const SECC = ['“DESDE PEQUEÑO”', '“El ELEGIDO”', '“LA LLAMADA”', '“EL PRIMER MILAGRO”', '“LOS DISCÍPULOS”', '“EL VIAJE”',
    '“LA PRUEBA”', '“EL SILENCIO”', '“LA PALABRA”', '“LA FIESTA”', '“EL INVIERNO”', '“LA CASA”',
    '“LA ORACIÓN”', '“EL PERDÓN”', '“LA LUZ”', '“EL PAN”', '“EL AGUA”', '“EL RETORNO”'];
  ['LA INFANCIA', 'LA JUVENTUD', 'LA MADUREZ'].forEach((cap, k) => {
    add(capitulo(cap));
    SECC.slice(k * 6, k * 6 + 6).forEach((s, j) => { add(seccion(s)); cuerpoP(`gonz-${4 + k}-${j}`, 2); });
  });

  // 5. ESTIGMAS («heading 1», 120)
  add(vacio(), bloque('ESTIGMAS', { estilo: 'Ttulo1', sz: 120 }));
  add(capitulo('INTRODUCCIÓN')); cuerpoP('estig-intro', 2, 'sanacion');
  add(capitulo('PRÓLOGO')); cuerpoP('estig-prologo', 2, 'monte');
  add(capitulo('CAPÍTULO I: “EL CAMINO MARCADO”'));
  add(seccion('FUNDAMENTO BÍBLICO._')); cuerpoP('estig-1-fund', 2, 'camino');
  add(seccion('SIGNIFICADO._')); cuerpoP('estig-1-sig', 2, 'sanacion');
  add(capitulo('CAPÍTULO II: “LAS HUELLAS DE LA PASIÓN”'));
  add(seccion('TESTIMONIOS._')); cuerpoP('estig-2-test', 2, 'perdon');
  add(seccion('ENSEÑANZA._')); cuerpoP('estig-2-ens', 2, 'luz');

  // 6. CATEQUESIS GONZALEANA («heading 2», 96): ~25 capítulos
  add(vacio(), bloque('CATEQUESIS GONZALEANA', { estilo: 'Ttulo2', sz: 96 }));
  const CAP = ['LA CUARESMA', 'LA SEMANA SANTA', 'LA FE', 'EL CREDO O SÍMBOLO DE LA FE', 'LA ESPERANZA', 'LA CARIDAD',
    'LOS SACRAMENTOS', 'EL BAUTISMO', 'LA EUCARISTÍA', 'LA CONFESIÓN', 'LA ORACIÓN', 'EL TEMPLO', 'LOS SANTOS',
    'LA PALABRA DE DIOS', 'LAS OBRAS DE MISERICORDIA', 'LOS DONES DEL ESPÍRITU', 'LAS VIRTUDES', 'EL ADVIENTO', 'LA NAVIDAD', 'LA PASCUA'];
  CAP.forEach((c, k) => {
    add(capitulo(c)); cuerpoP('cateq-' + k, 2);
    if (k === 2) {                                                     // capítulo de varias líneas con etiqueta
      add(capitulo('EL PECADO'), capitulo('"LA DESOBEDIENCIA A DIOS"'), par('(PRIMERA COMUNIÓN)', { jc: 'center', sz: 28, b: true }));
      cuerpoP('cateq-pecado', 3, 'perdon');
    }
    if (k === 5) {                                                     // «heading 1» que es capítulo, no bloque; lista numerada
      add(capitulo('LOS MANDAMIENTOS', { estilo: 'Ttulo1', sz: null }));
      cuerpoP('cateq-mand', 1, 'monte');
      ['Amarás a Dios sobre todas las cosas.', 'No tomarás su nombre en vano.', 'Santificarás las fiestas.', 'Honrarás a tu padre y a tu madre.']
        .forEach(t => add(par(t, { estilo: 'Prrafodelista', jc: 'both', b: true, lista: true })));
    }
    if (k === 7) { add(capitulo('LA SANTA MISA', { estilo: 'Ttulo1', sz: null })); cuerpoP('cateq-misa', 2, 'pan'); }
    if (k === 8) { add(capitulo('LA CONFIRMACIÓN'), par('(CONFIRMACIÓN)', { jc: 'center', sz: 28, b: true })); cuerpoP('cateq-confirmacion', 2, 'luz'); }
  });

  // 7. CREDO GONZALEANO: 3 capítulos; el Credo en negrita y justificado
  add(vacio(), bloque('CREDO GONZALEANO', { sz: 96 }));
  add(capitulo('ORIGEN DEL CREDO')); cuerpoP('credo-1', 2, 'camino');
  add(capitulo('EL CREDO'));
  ['Creo en el Dios de la luz que no se apaga,', 'creador de la tierra buena y del agua viva,', 'y en su Hijo, pastor de los que se pierden,',
    'que caminó entre los pueblos y partió el pan,', 'que sanó al enfermo y perdonó al hermano,', 'y que volverá como vuelve el alba.',
    'Creo en la casa edificada sobre roca,', 'en la semilla que da fruto a su tiempo,', 'en el perdón de las deudas y en la vida que no termina.', 'Amén.']
    .forEach(t => add(texto(t, { b: true })));
  add(capitulo('EXPLICACIÓN DEL CREDO')); cuerpoP('credo-3', 3, 'casa');

  // 8. TEOFANÍAS
  add(vacio(), bloque('TEOFANÍAS', { sz: 96 }));
  add(capitulo('INTRODUCCIÓN')); cuerpoP('teof-intro', 2, 'monte');
  add(capitulo('PRÓLOGO')); cuerpoP('teof-prologo', 2, 'luz');
  add(capitulo('CAPÍTULO I: “LA ZARZA”')); cuerpoP('teof-1', 3, 'invierno');
  add(capitulo('CAPÍTULO II: “LA NUBE SOBRE EL MONTE”')); cuerpoP('teof-2', 3, 'monte');

  // 9. LOGOS («heading 1», 120, sin negrita): entradas fechadas con «heading 3»
  add(vacio(), bloque('LOGOS', { estilo: 'Ttulo1', sz: 120, b: false }));
  add(capitulo('INTRODUCCIÓN')); cuerpoP('logos-intro', 2, 'agua');
  add(capitulo('PRÓLOGO')); cuerpoP('logos-prologo', 1, 'luz');
  LOGOS.forEach(([f, tema], k) => {
    add(par(f, { estilo: 'Ttulo3', jc: 'left' }));
    const extra = op.modificarLogos && k === 3 ? [[0, 'Este párrafo fue modificado en la versión nueva del documento de prueba.']] : [];
    cuerpoP('logos-' + k, 2, tema, extra);
  });

  // 10. CRÓNICAS («heading 1», 120): crónicas entre comillas; una muy larga
  add(vacio(), bloque('CRÓNICAS', { estilo: 'Ttulo1', sz: 120 }));
  add(capitulo('PRÓLOGO')); cuerpoP('cron-prologo', 2, 'camino', [[1, 'Lo dice la Palabra (Palabra del Señor, 20 de julio de 2024) y también (Palabra del Señor, 1 de enero de 2020).']]);
  CRONICAS.forEach(([t, tema, larga], k) => {
    if (op.insertarCronica && k === 5) { add(seccion('“La lámpara del sacristán”')); cuerpoP('cron-nueva', 3, 'luz', [[1, FRASE_UNICA_DOCTRINA]]); }
    const titulo = op.renombrarCronica && k === 7 ? '“La oveja que regresó al redil”' : t;
    add(seccion(titulo));
    if (larga) {                                                       // más de 10,000 palabras
      for (let i = 0; i < 26; i++) cuerpo(`cron-larga-${i}`, 20, ['invierno', 'camino', 'monte', 'casa'][i % 4]).forEach(x => add(texto(x)));
    } else cuerpoP('cron-' + k, 3, tema, k === 0 ? [[0, 'Recordé entonces (Lect. Gonz. 145) y lloré.']] : []);
  });

  // 11. NOVENARIOS (116)
  add(vacio(), bloque('NOVENARIOS', { sz: 116 }));
  ['NOVENARIO 7 DE AGOSTO', 'NOVENARIO 3 DE NOVIEMBRE'].forEach((n, k) => {
    add(capitulo(n));
    ['PRIMER DÍA._', 'SEGUNDO DÍA._', 'TERCER DÍA._'].forEach((d, j) => { add(seccion(d)); cuerpoP(`nov-${k}-${j}`, 2); });
  });
  return P;
}

export async function generarDoctrina(JSZip, opciones = {}) {
  const ps = construirDoctrina(opciones);
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${ps.join('')}<w:sectPr/></w:body></w:document>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', TIPOS);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', DOC_RELS);
  zip.file('word/document.xml', doc);
  zip.file('word/styles.xml', ESTILOS);
  zip.file('word/numbering.xml', NUMERACION);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}
