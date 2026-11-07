/* ============================================================
   Pruebas de Kyrien (Doctrina Gonzaleana) en el navegador:
   genera el .docx FICTICIO, lo lee con el mismo lector de la app
   (formato visual: tamaño, negrita, alineación, listas) y comprueba
   el analizador, las referencias y la identidad por ruta.
   ============================================================ */
import { leerDocx } from '../js/docx.js';
import * as D from '../js/analizadores/doctrina.js';
import { generarDoctrina } from './generador-doctrina.js';

export async function correr(prueba, igual, verdad) {
  const m = await import('jszip'); const JSZip = m.default || m;
  const leer = async op => leerDocx((await generarDoctrina(JSZip, op)).buffer);
  const pv1 = await leer({});
  const r1 = D.analizar(pv1);
  const piezas = r1.piezas.map((p, i) => ({ ...p, id: 'doctrina|' + p.clave, orden: i }));
  const de = (bloque) => piezas.filter(p => D.abreviatura(p.bloque) === bloque);
  const cap = t => piezas.find(p => p.capitulo.includes(t));

  prueba('Doctrina: el lector del .docx lee el formato (tamaño, negrita, alineación, listas)', () => {
    const est = pv1.find(p => p.texto === 'ESTIGMAS');
    igual([est.tam, est.negrita, est.alin, est.estilo], [120, true, 'center', 'heading 1']);
    const logos = pv1.find(p => p.texto === 'LOGOS');
    igual([logos.tam, logos.negrita], [120, false], 'LOGOS sin negrita (w:b val=0 sobre un estilo en negrita)');
    const mand = pv1.find(p => p.texto === 'LOS MANDAMIENTOS');
    igual([mand.tam, mand.negrita, mand.alin], [32, true, 'center'], 'tamaño heredado del estilo «heading 1»');
    verdad(pv1.find(p => p.texto.startsWith('Amarás a Dios')).lista, 'lista numerada');
    const credo = pv1.find(p => p.texto === 'Amén.');
    igual([credo.negrita, credo.alin, credo.tam], [true, 'both', 24]);
  });
  prueba('Doctrina: 11 bloques por formato visual, en orden', () => {
    igual(r1.informe.datos.titulosBloques, ['DOCTRINA GONZALEANA', 'CRISTOLOGÍA GONZALEANA', 'MARIOLOGÍA GONZALEANA', 'GONZALEANOLOGÍA',
      'ESTIGMAS', 'CATEQUESIS GONZALEANA', 'CREDO GONZALEANO', 'TEOFANÍAS', 'LOGOS', 'CRÓNICAS', 'NOVENARIOS']);
    igual(r1.informe.datos.bloques, 11);
  });
  prueba('Doctrina: árbol Bloque → (Parte) → Capítulo → Sección', () => {
    const arb = r1.informe.arbol;
    const caps = b => { let n = 0; const rec = x => x.hijos.forEach(h => { if (h.tipo === 'capitulo') n++; rec(h); }); rec(b); return n; };
    const secs = b => { let n = 0; const rec = x => x.hijos.forEach(h => { if (h.tipo === 'seccion') n++; rec(h); }); rec(b); return n; };
    igual(arb.map(caps), [2, 6, 4, 6, 4, 24, 3, 4, 2, 1, 2], 'capítulos por bloque');
    igual(arb.map(secs), [0, 3, 0, 18, 4, 0, 0, 0, 12, 10, 6], 'secciones por bloque');
    igual(arb[3].hijos.map(h => h.tipo + ':' + h.titulo), ['parte:PARTE I._ “ENSEÑANZA HISTÓRICA”', 'parte:PARTE II._ “ENSEÑANZA CRONOLÓGICA”']);
    // Las crónicas y las entradas de Logos son hermanas del Prólogo
    igual(arb[9].hijos.map(h => h.tipo).join(','), 'capitulo,' + Array(10).fill('seccion').join(','));
  });
  prueba('Doctrina: títulos de varias líneas y etiquetas de grupo', () => {
    verdad(cap('NUESTRO SEÑOR JESUCRISTO “EL HIJO DE DIOS”'), 'título de dos líneas');
    const pec = cap('EL PECADO');
    igual([pec.capitulo, pec.etiquetas], ['EL PECADO "LA DESOBEDIENCIA A DIOS"', ['PRIMERA COMUNIÓN']]);
    igual(cap('LA CONFIRMACIÓN').etiquetas, ['CONFIRMACIÓN']);
  });
  prueba('Doctrina: «heading 1» de Catequesis es capítulo, no bloque; las listas son cuerpo', () => {
    const m = cap('LOS MANDAMIENTOS');
    igual([D.abreviatura(m.bloque), m.nivelPieza], ['Cateq', 'capitulo']);
    verdad(m.parrafos.includes('Santificarás las fiestas.'), 'la lista quedó en el capítulo');
    igual(D.abreviatura(cap('LA SANTA MISA').bloque), 'Cateq');
  });
  prueba('Doctrina: el Credo queda como un capítulo con su texto completo', () => {
    const c = piezas.find(p => p.capitulo === 'EL CREDO');
    igual([c.nivelPieza, c.parrafos.length, c.parrafos[0], c.parrafos[9]], ['capitulo', 10, 'Creo en el Dios de la luz que no se apaga,', 'Amén.']);
    verdad(!piezas.some(p => p.bloque === 'CREDO GONZALEANO' && p.nivelPieza === 'seccion'), 'líneas del Credo tomadas como secciones');
  });
  prueba('Doctrina: secciones («._», comillas “ ” y " ", mayúsculas mezcladas, fechas de Logos)', () => {
    verdad(piezas.find(p => p.seccion === 'FUNDAMENTO BÍBLICO._'));
    verdad(piezas.find(p => p.seccion === '"El regreso a casa"'));
    verdad(piezas.find(p => p.seccion === '“El ELEGIDO”' && p.parte.startsWith('PARTE II')));
    const l = piezas.find(p => p.seccion === 'Sábado 20 de septiembre de 2025:');
    igual([l.fecha, D.corta(l)], ['2025-09-20', 'Logos·20/09/25']);
  });
  prueba('Doctrina: título dudoso informado y crónica muy larga en una sola pieza', () => {
    verdad(r1.informe.datos.dudosos.some(d => d.texto === 'ORACIÓN FINAL'), 'falta el dudoso');
    const larga = piezas.find(p => p.seccion === '“La noche más larga”');
    const palabras = larga.parrafos.join(' ').split(/\s+/).length;
    verdad(palabras > 10000, 'palabras: ' + palabras);
  });
  prueba('Doctrina: etiquetas cortas y títulos de ventana', () => {
    const t = piezas.find(p => p.seccion === '“Te fallé”');
    igual([D.corta(t), D.etiqueta(t).ref, D.etiqueta(t).tipo], ['Crón·1', 'Crónicas · “Te fallé”', 'Crónicas']);
    igual(D.corta(cap('EL BUEN PASTOR')), 'Crist·3');
    igual(D.corta(piezas.find(p => p.seccion === 'LA PROMESA._')), 'Crist·2.1');
    igual(D.corta(piezas.find(p => p.bloque === 'CRÓNICAS' && p.capitulo === 'PRÓLOGO')), 'Crón·Pról');
    igual(D.corta(piezas.find(p => p.seccion === 'FUNDAMENTO BÍBLICO._')), 'Estig·1.1');
  });
  prueba('Doctrina: referencias (bloques, títulos, fechas de Logos, combinaciones)', () => {
    const ref = q => (D.resolverReferencia(q, piezas)?.ids || []).map(id => piezas.find(p => p.id === id));
    verdad(ref('Crónicas').length === 5 && ref('Crónicas').every(p => p.bloque === 'CRÓNICAS'), 'Crónicas');
    igual(ref('te falle')[0]?.seccion, '“Te fallé”');
    igual(ref('El hijo de Dios')[0]?.capitulo, 'NUESTRO SEÑOR JESUCRISTO “EL HIJO DE DIOS”');
    igual(ref('Logos 20 de septiembre de 2025')[0]?.fecha, '2025-09-20');
    igual(ref('7 de agosto 2017')[0]?.fecha, '2017-08-07');
    igual(ref('Estigmas fundamento biblico')[0]?.seccion, 'FUNDAMENTO BÍBLICO._');
    verdad(ref('Credo').every(p => p.bloque === 'CREDO GONZALEANO'), 'Credo');
    igual(D.resolverReferencia('1 de enero de 1999', piezas).ids, []);
    igual(D.resolverReferencia('los hombres que pescan en el lago', piezas), null);
  });
  const r2 = D.analizar(await leer({ insertarCristologia: true, insertarCronica: true, modificarLogos: true }));
  const huella = r => new Map(r.piezas.map(p => [p.clave, JSON.stringify(p.parrafos)]));
  const h1 = huella(r1), h2 = huella(r2);
  const nuevas = [...h2.keys()].filter(k => !h1.has(k)), modificadas = [...h2.keys()].filter(k => h1.has(k) && h1.get(k) !== h2.get(k));
  const eliminadas = [...h1.keys()].filter(k => !h2.has(k));
  prueba('Doctrina: insertar en medio de Cristología y Crónicas y modificar Logos → 2 nuevas, 1 modificada, 0 eliminadas', () => {
    igual([nuevas.length, modificadas.length, eliminadas.length], [2, 1, 0], JSON.stringify({ nuevas, modificadas }));
  });
  const r3 = D.analizar(await leer({ renombrarCronica: true }));
  const h3 = huella(r3);
  prueba('Doctrina: título cambiado con el mismo texto = renombrada (mismo contenido, otra ruta)', () => {
    const nueva = [...h3.keys()].filter(k => !h1.has(k)), quitada = [...h1.keys()].filter(k => !h3.has(k));
    igual([nueva.length, quitada.length], [1, 1]);
    igual(h3.get(nueva[0]), h1.get(quitada[0]));
  });
  const rSin = D.analizar(await leer({ sinBloques: true }));
  prueba('Doctrina: sin bloques → informe.ok = false y mensaje claro', () => {
    igual(rSin.informe.ok, false); verdad(rSin.informe.mensaje.length > 40);
  });
}
