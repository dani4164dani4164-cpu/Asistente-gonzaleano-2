/* ============================================================
   Generador del DOCUMENTO DE PRUEBA (FICTICIO) de Agios.
   Misma estructura que el documento real (encabezados reales,
   estilos «heading 1»/«heading 2» con styleId en español), pero con
   TEXTO INVENTADO. Incluye a propósito:
     - INTRODUCCIÓN (no cuenta como pieza)
     - conjuntos 89 a 94 sin Santo Evangelio
     - espacios sobrantes, sin acentos, MAYÚSCULAS, «Décima Primera»
       (primeros conjuntos) y «Undécima/Duodécima» (centenas)
     - apellidos de Salmo («de Súplica», «de Penitencia», «Penitencial»)
     - marcas: autor, cierres, «Canto», «Todos: …», «Aleluya, aleluya»
     - un encabezado no reconocible («Nota del copista»)
     - texto borrado con control de cambios (no debe leerse)
   Uso: generarDocumento(JSZip, opciones) → Promise<Uint8Array>
   ============================================================ */
import { numeroAOrdinal } from '../js/ordinales.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* Temas inventados: sirven para probar la búsqueda por significado. */
export const TEMAS = {
  mar: [
    'Los pescadores salieron al lago antes del alba y la barca crujía sobre las olas.',
    'Echaron las redes a la derecha y las sacaron llenas de peces plateados.',
    'En la orilla esperaban las mujeres con canastos para recibir la pesca.',
    'El viento del lago empujó la barca hasta la otra ribera.',
    'Uno de ellos remendaba las redes rotas sentado sobre la arena húmeda.',
    'Al volver, los pescadores repartieron los peces entre las familias del puerto.',
    'La barca quedó amarrada junto al muelle de piedra.',
    'Durante toda la noche no habían pescado nada, pero no se desanimaron.',
  ],
  pastor: [
    'El pastor contó su rebaño al caer la tarde y le faltaba una oveja.',
    'Dejó a las noventa y nueve en el redil y subió por las lomas buscándola.',
    'La encontró enredada entre zarzas, temblando y sin balar.',
    'La cargó sobre sus hombros y regresó cantando por el sendero.',
    'Con su cayado apartaba las piedras para que el rebaño no tropezara.',
    'Las ovejas reconocen la voz del pastor y lo siguen sin miedo.',
    'Al llegar al redil llamó a sus vecinos para celebrar.',
    'Ningún lobo pudo acercarse porque el pastor velaba junto a la puerta.',
  ],
  sembrador: [
    'Salió el sembrador a sembrar y esparció la semilla a manos llenas.',
    'Una parte cayó en el surco profundo y brotó con fuerza.',
    'Otra cayó entre piedras y se secó al primer calor.',
    'La tierra buena dio trigo abundante, treinta, sesenta y cien granos por espiga.',
    'Los labradores esperaron con paciencia la lluvia temprana y la tardía.',
    'Llegado el tiempo de la cosecha, las gavillas llenaron los graneros.',
    'El campo, que antes era yermo, se cubrió de espigas doradas.',
    'Arrancaron la cizaña con cuidado para no dañar el trigo.',
  ],
  luz: [
    'Encendieron la lámpara y la pusieron sobre el candelero para que alumbrara la casa.',
    'Las jóvenes prudentes llevaban aceite de reserva para sus candiles.',
    'A medianoche se oyó un grito y todas despertaron a recortar las mechas.',
    'La claridad de la lámpara alcanzaba hasta el último rincón del cuarto.',
    'Nadie enciende un candil para esconderlo debajo de la cama.',
    'Cuando se apagó la última estrella, la llama seguía viva.',
    'El resplandor se veía desde lejos, como una ciudad en lo alto.',
    'Guardaron el aceite en vasijas de barro para las noches largas.',
  ],
  agua: [
    'Junto al pozo, una mujer sacaba agua con su cántaro al mediodía.',
    'El que beba de este manantial no volverá a tener sed.',
    'La fuente brotaba fresca entre las rocas del valle.',
    'Llenaron seis tinajas de piedra hasta el borde.',
    'Los caminantes se detuvieron a beber en el pozo del pueblo.',
    'El agua corría por las acequias y regaba los huertos.',
    'Bajó al río y se lavó el rostro cansado.',
    'El cántaro quedó olvidado junto al brocal del pozo.',
  ],
  pan: [
    'Tomó los cinco panes, los partió y los repartió entre la multitud.',
    'Recogieron las sobras y llenaron doce canastos.',
    'La harina de la tinaja no se acabó en todo aquel año.',
    'Amasaron antes del amanecer y el horno perfumó la calle.',
    'Pusieron la mesa para los que llegaban con hambre del camino.',
    'Cada uno recibió su porción y nadie quedó sin comer.',
    'El panadero guardó la levadura para el día siguiente.',
    'Se sentaron sobre la hierba en grupos de cincuenta.',
  ],
  perdon: [
    'Le preguntó cuántas veces debía perdonar a su hermano.',
    'No siete veces, sino setenta veces siete, le respondió.',
    'El rey perdonó toda la deuda al siervo que le suplicaba.',
    'Los dos hermanos se reconciliaron después de muchos años de silencio.',
    'Dejó su ofrenda junto al altar y fue primero a buscar a su hermano.',
    'Quien guarda rencor carga una piedra que no lo deja caminar.',
    'Se abrazaron en la puerta de la casa paterna y lloraron juntos.',
    'La ofensa quedó olvidada y volvieron a compartir la mesa.',
  ],
  monte: [
    'Subió al monte a orar en silencio y pasó allí toda la noche.',
    'Desde la cumbre se veían los pueblos dormidos del valle.',
    'Los discípulos se quedaron dormidos mientras él rezaba.',
    'En lo alto de la montaña la nube los cubrió con su sombra.',
    'Bajaron del monte sin contar a nadie lo que habían visto.',
    'Se retiraba a lugares solitarios para hablar con el Padre.',
    'El camino hacia la cima era empinado y lleno de piedras sueltas.',
    'Al amanecer, la oración seguía subiendo como incienso.',
  ],
  sanacion: [
    'Le trajeron un enfermo tendido en una camilla.',
    'Lo tomó de la mano y la fiebre lo dejó en ese instante.',
    'Levántate, toma tu camilla y anda, le dijo.',
    'El que estaba sanado se fue a su casa dando gloria a Dios.',
    'Una mujer tocó el borde de su manto y quedó curada.',
    'Los leprosos lo esperaban a la entrada del pueblo.',
    'Puso barro en los ojos del ciego y le mandó lavarse.',
    'Toda la ciudad se agolpó a la puerta trayendo a sus dolientes.',
  ],
  camino: [
    'Iban dos caminantes hacia una aldea, conversando por el camino.',
    'Llevaban las sandalias cubiertas de polvo después de tres jornadas.',
    'Al atardecer pidieron alojamiento en una posada sencilla.',
    'El peregrino no llevaba bolsa ni bastón, solo su manto.',
    'El sendero cruzaba viñedos y olivares hasta la colina.',
    'En cada cruce de caminos dejaban una señal para los que venían detrás.',
    'Partieron al alba y llegaron a la ciudad antes del sábado.',
    'Sacudieron el polvo de sus pies a la salida del pueblo.',
  ],
  invierno: [
    'Hacía frío y los criados encendieron una hoguera en el patio.',
    'Se acercaban al fuego para calentarse las manos.',
    'La leña crepitaba y las chispas subían hacia la noche helada.',
    'Cubrieron a los niños con mantas de lana gruesa.',
    'La nieve cubrió los techos y el humo salía de las chimeneas.',
    'Compartieron sus abrigos con los que dormían a la intemperie.',
    'Junto al brasero contaban historias de los antiguos.',
    'Al alba, las brasas todavía guardaban un poco de calor.',
  ],
  casa: [
    'Un hombre prudente construyó su casa cavando hondo los cimientos.',
    'Vino la tormenta, crecieron los ríos y la casa no se derrumbó.',
    'Otro levantó la suya sobre arena y se vino abajo con el primer aguacero.',
    'Pusieron la piedra angular en presencia de todo el pueblo.',
    'Los albañiles trabajaron con escuadra y plomada.',
    'El techo resistió el granizo porque las vigas eran firmes.',
    'Abrió la puerta de su casa a los forasteros.',
    'Sobre la roca se alzaron los muros, sólidos como una fortaleza.',
  ],
};
const NOMBRES_TEMAS = Object.keys(TEMAS);
export const temaDe = (n, tipo) => NOMBRES_TEMAS[(n * 3 + { lectura: 0, salmo: 5, evangelio: 7 }[tipo]) % NOMBRES_TEMAS.length];

const RESPUESTAS = ['Señor, escucha nuestra voz.', 'Tu palabra es lámpara para mis pasos.', 'Bendito sea el nombre del Señor.', 'Ten piedad de nosotros.'];
const CIERRES = ['Palabra del mismo Señor Jesucristo', 'Palabra del mismo Señor Jesús', 'Palabras del mismo Señor Jesucristo'];
export const FRASE_UNICA = 'Y la lámpara del alfarero ardió toda la noche sin aceite, hasta que llegó la mañana.';

/* ---------- Encabezados ---------- */
function quitarAcentos(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function variante(n, texto) {
  if (n === 20) return texto.toUpperCase();                    // VIGÉSIMA SANTA LECTURA
  if (n % 37 === 5) return '  ' + texto + '   ';               // espacios sobrantes
  if (n % 41 === 7) return quitarAcentos(texto);                // sin acentos
  if (n % 53 === 0) return texto.toLowerCase();
  return texto;
}
export function tituloLectura(n) {
  return variante(n, `${numeroAOrdinal(n, { genero: 'f', once: n < 100 ? 'compuesta' : 'simple' })} Santa Lectura`);
}
export function apellidoSalmo(n) {
  if (n === 7 || n % 11 === 7) return ' Penitencial';
  if (n % 7 === 6) return ' de Penitencia';
  if (n % 7 === 2) return ' de Súplica';
  return '';
}
export function tituloSalmo(n) {
  return variante(n + 1, `${numeroAOrdinal(n, { genero: 'm', once: n < 100 ? 'compuesta' : 'simple' })} Santo Salmo${apellidoSalmo(n)}`);
}
export function tituloEvangelio(n) {
  const ap = n === 16 || n % 9 === 4 ? ' de Jesucristo' : '';
  return variante(n + 2, `${numeroAOrdinal(n, { genero: 'm', once: n < 100 ? 'compuesta' : 'simple' })} Santo Evangelio${ap}`);
}

/* ---------- XML ---------- */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = t => `<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
function parrafo(texto, estilo = null, { partir = false, extra = '' } = {}) {
  const pPr = estilo ? `<w:pPr><w:pStyle w:val="${estilo}"/></w:pPr>` : '';
  let runs;
  if (partir && texto.length > 8) { const k = Math.floor(texto.length / 2); runs = run(texto.slice(0, k)) + `<w:r w:rsidR="00A1B2C3">${run(texto.slice(k)).slice(5)}`; }
  else runs = run(texto);
  return `<w:p w:rsidR="00C0FFEE">${pPr}${runs}${extra}</w:p>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/><w:lang w:val="es-MX"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Ttulo2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="character" w:default="1" w:styleId="Fuentedeprrafopredeter"><w:name w:val="Default Paragraph Font"/></w:style>
</w:styles>`;

const TIPOS_CONTENIDO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/**
 * opciones:
 *   conjuntos     cuántos conjuntos (371)
 *   sinEvangelio  números sin Santo Evangelio ([89..94])
 *   modificar     [{tipo, numero}] piezas con una frase cambiada (versión nueva del documento)
 *   sinEstructura true → solo texto normal (debe dar luz roja)
 */
export function construirParrafos({ conjuntos = 371, sinEvangelio = [89, 90, 91, 92, 93, 94], modificar = [], sinEstructura = false } = {}) {
  const r = rng(7);
  const ps = [];   // [texto, estilo, opciones]
  const tomar = (tema, k) => { const b = [...TEMAS[tema]]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b.slice(0, k); };
  const cuerpo = (tema, nPar, largo = false) => {
    const out = [];
    for (let i = 0; i < nPar; i++) out.push(tomar(tema, largo && i === 0 ? 8 : 2 + Math.floor(r() * 3)).join(' '));
    if (largo) out[0] = out[0] + ' ' + tomar(tema, 8).join(' ') + ' ' + tomar(tema, 6).join(' ');
    return out;
  };
  const cambiada = (tipo, n) => modificar.some(m => m.tipo === tipo && m.numero === n);

  if (sinEstructura) {
    ps.push(['Documento sin títulos (FICTICIO, de prueba).', null]);
    for (let i = 0; i < 40; i++) ps.push([tomar(NOMBRES_TEMAS[i % 12], 3).join(' '), null]);
    return ps;
  }

  ps.push(['INTRODUCCIÓN', 'Ttulo1']);
  ps.push(['Este es un DOCUMENTO FICTICIO DE PRUEBA para Agios. Todo su texto es inventado; solo imita la estructura de encabezados del documento real.', null]);
  ps.push(['Sirve para comprobar el analizador, la búsqueda exacta, la búsqueda por significado y el lector sin usar ningún documento personal.', null]);

  for (let n = 1; n <= conjuntos; n++) {
    // Santa Lectura
    ps.push([tituloLectura(n), 'Ttulo1', { partir: n % 5 === 0 }]);
    ps.push(['Escrita por el Profeta San Gonzalo Pío de San Miguel', null]);
    for (const t of cuerpo(temaDe(n, 'lectura'), 2 + (n % 3), n % 50 === 0)) ps.push([t, null]);
    if (cambiada('lectura', n)) ps.push(['Esta frase fue agregada en la versión nueva del documento de prueba.', null]);
    if (n === 33) ps.push(['Estas palabras quedaron tal cual.', null, { extra: '<w:del w:id="1" w:author="x"><w:r><w:delText>TEXTO BORRADO QUE NO DEBE APARECER</w:delText></w:r></w:del>' }]);
    ps.push([CIERRES[n % 3], null]);
    ps.push(['', null]);
    // Santo Salmo
    ps.push([tituloSalmo(n), 'Ttulo2']);
    ps.push(['Escrito por el Profeta San Gonzalo Pío de San Miguel', null]);
    ps.push(['Canto', null]);
    const resp = RESPUESTAS[n % RESPUESTAS.length];
    ps.push(['Todos: ' + resp, null]);
    for (const t of cuerpo(temaDe(n, 'salmo'), 2)) ps.push([t, null]);
    if (cambiada('salmo', n)) ps.push(['Esta frase fue agregada en la versión nueva del documento de prueba.', null]);
    ps.push(['Todos: ' + resp, null]);
    ps.push(['Aleluya, aleluya', null]);
    // Santo Evangelio
    if (!sinEvangelio.includes(n)) {
      ps.push([tituloEvangelio(n), 'Ttulo2']);
      ps.push(['Escrito por el Profeta San Gonzalo Pío de San Miguel', null]);
      for (const t of cuerpo(temaDe(n, 'evangelio'), 2 + (n % 2))) ps.push([t, null]);
      if (n === 145) ps.push([FRASE_UNICA, null]);
      if (cambiada('evangelio', n)) ps.push(['Esta frase fue agregada en la versión nueva del documento de prueba.', null]);
      ps.push([CIERRES[(n + 1) % 3], null]);
    }
    if (n === 200) {
      ps.push(['Nota del copista', 'Ttulo2']);
      ps.push(['Aquí el copista dejó una nota que no pertenece a ninguna pieza.', null]);
    }
  }
  return ps;
}

export async function generarDocumento(JSZip, opciones = {}) {
  const ps = construirParrafos(opciones);
  const cuerpo = ps.map(([t, e, o]) => parrafo(t, e, o || {})).join('');
  const tabs = '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr></w:p>';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${tabs}${cuerpo}<w:sectPr/></w:body></w:document>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', TIPOS_CONTENIDO);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', DOC_RELS);
  zip.file('word/document.xml', doc);
  zip.file('word/styles.xml', ESTILOS);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}
