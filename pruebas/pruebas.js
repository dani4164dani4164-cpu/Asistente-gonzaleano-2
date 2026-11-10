/* ============================================================
   Pruebas unitarias de Agios (corren en el navegador: abre
   pruebas/index.html). No usan ningún documento real.
   ============================================================ */
import { ordinalANumero, numeroAOrdinal } from '../js/ordinales.js';
import * as A from '../js/analizadores/lecturas.js';
import { fragmentar } from '../js/motor/fragmentos.js';
import * as B from '../js/motor/buscador.js';
import { normalizarConMapa, rangos } from '../js/texto.js';
import { construirParrafos, FRASE_UNICA } from './generador.js';

const resultados = [];
function prueba(nombre, fn) {
  try { fn(); resultados.push({ nombre, ok: true }); }
  catch (e) { resultados.push({ nombre, ok: false, error: e.message }); }
}
function igual(a, b, msg = '') {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${msg} esperado ${jb}, obtenido ${ja}`);
}
const verdad = (c, msg) => { if (!c) throw new Error(msg || 'falso'); };

/* ---------- Ordinales ---------- */
const EJEMPLOS = {
  'Primera': 1, 'Décima Primera': 11, 'Vigésima': 20, 'Centésima Undécima': 111,
  'Ducentésima Quincuagésima Primera': 251, 'Tricentésima Septuagésima Primera': 371,
  'Primer': 1, 'Primero': 1, 'Segundo': 2, 'Sexto': 6, 'Séptimo': 7,
  'Tricentésimo Septuagésimo Primer': 371, 'Décimo Sexto': 16,
  'Tercera': 3, 'Tercer': 3, 'Tercero': 3, 'Undécima': 11, 'Duodécima': 12, 'Décima Segunda': 12,
  'decima primera': 11, 'DÉCIMA PRIMERA': 11, '  Vigésima  ': 20, 'Cuadringentésima': 400,
  'Cuadringentésima Septuagésima Segunda': 472, 'Quingentésimo Primer': 501, 'Noningentésima Nonagésima Novena': 999,
  'decimoprimero': 11, 'vigesimotercera': 23,
};
prueba('Ordinales: todos los ejemplos de la especificación', () => {
  for (const [t, n] of Object.entries(EJEMPLOS)) igual(ordinalANumero(t), n, t);
});
prueba('Ordinales: ida y vuelta 1–999, ambos géneros, ambas formas de 11 y 12', () => {
  for (let n = 1; n < 1000; n++) for (const genero of ['f', 'm']) for (const once of ['simple', 'compuesta']) for (const apocope of [true, false]) {
    const t = numeroAOrdinal(n, { genero, once, apocope });
    igual(ordinalANumero(t), n, t);
    igual(ordinalANumero(t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()), n, t + ' (sin acentos)');
  }
});
prueba('Ordinales: lo que no es ordinal da null', () => {
  for (const t of ['', 'hola', 'santa', 'Lectura', 'primera segunda', 'décimo décimo', 'INTRODUCCIÓN']) igual(ordinalANumero(t), null, t);
});

/* ---------- Encabezados ---------- */
prueba('Encabezados reales de la especificación', () => {
  const casos = [
    ['Primera Santa Lectura', 'lectura', 1, ''], ['Décima Primera Santa Lectura', 'lectura', 11, ''],
    ['Vigésima Santa Lectura', 'lectura', 20, ''], ['Centésima Undécima Santa Lectura', 'lectura', 111, ''],
    ['Ducentésima Quincuagésima Primera Santa Lectura', 'lectura', 251, ''],
    ['Tricentésima Septuagésima Primera Santa Lectura', 'lectura', 371, ''],
    ['Primer Santo Salmo', 'salmo', 1, ''], ['Segundo Santo Salmo de Súplica', 'salmo', 2, 'de Súplica'],
    ['Sexto Santo Salmo de Penitencia', 'salmo', 6, 'de Penitencia'], ['Séptimo Santo Salmo Penitencial', 'salmo', 7, 'Penitencial'],
    ['Tricentésimo Septuagésimo Primer Santo Salmo', 'salmo', 371, ''],
    ['Primer Santo Evangelio', 'evangelio', 1, ''], ['Décimo Sexto Santo Evangelio de Jesucristo', 'evangelio', 16, 'de Jesucristo'],
    ['   Tercera Santa Lectura  ', 'lectura', 3, ''], ['tercer santo salmo', 'salmo', 3, ''],
    ['DECIMA SEGUNDA SANTA LECTURA', 'lectura', 12, ''], ['Centésima Duodécima Santa Lectura', 'lectura', 112, ''],
  ];
  for (const [t, tipo, numero, apellido] of casos) igual(A.reconocerEncabezado(t), { tipo, numero, apellido }, t);
  igual(A.reconocerEncabezado('INTRODUCCIÓN'), { tipo: 'introduccion' });
  igual(A.reconocerEncabezado('Nota del copista'), null);
});

/* ---------- Analizador sobre el documento de prueba ---------- */
const parrafosPrueba = construirParrafos().map(([t, e]) => ({ nivel: e === 'Ttulo1' ? 1 : e === 'Ttulo2' ? 2 : 0, texto: t }));
const analisis = A.analizar(parrafosPrueba);
prueba('Analizador: cuenta conjuntos, lecturas, salmos y evangelios', () => {
  const d = analisis.informe.datos;
  igual([d.conjuntos, d.lecturas, d.salmos, d.evangelios, d.introduccion], [371, 371, 371, 365, true]);
});
prueba('Analizador: conjuntos 89–94 sin Evangelio se aceptan y se reportan', () => {
  igual(analisis.informe.datos.faltantes.evangelios, [89, 90, 91, 92, 93, 94]);
  verdad(analisis.informe.avisos.some(a => /sin Santo Evangelio/.test(a.titulo) && a.items[0].startsWith('89–94')), 'falta el aviso');
});
prueba('Analizador: la Introducción es sección aparte, no pieza', () => {
  const intro = analisis.piezas.filter(p => p.tipo === 'introduccion');
  igual(intro.length, 1); verdad(intro[0].parrafos.length >= 2);
});
prueba('Analizador: encabezado no reconocido reportado, sin perder su texto', () => {
  const nr = analisis.informe.datos.noReconocidos;
  igual(nr.map(x => x.texto), ['Nota del copista']);
  const ev200 = analisis.piezas.find(p => p.tipo === 'evangelio' && p.numero === 200);
  verdad(ev200.parrafos.includes('Nota del copista'));
});
prueba('Analizador: metadatos de autor y cierre', () => {
  const l1 = analisis.piezas.find(p => p.tipo === 'lectura' && p.numero === 1);
  igual(l1.autor, 'Escrita por el Profeta San Gonzalo Pío de San Miguel');
  verdad(/^Palabras? del mismo Señor/.test(l1.cierre));
});
prueba('Analizador: muestra con primer y último conjunto', () => {
  igual(analisis.informe.muestra.map(m => m.numero), [1, 371]);
});
prueba('Analizador: sin estructura → informe.ok = false y mensaje claro', () => {
  const r = A.analizar(construirParrafos({ sinEstructura: true }).map(([t]) => ({ nivel: 0, texto: t })));
  igual(r.informe.ok, false); verdad(r.informe.mensaje.length > 40);
});
prueba('Analizador: repetidos y fuera de orden', () => {
  const ps = [[1, 'Primera Santa Lectura'], [0, 'a'], [1, 'Tercera Santa Lectura'], [0, 'b'], [2, 'Tercer Santo Salmo'], [1, 'Tercera Santa Lectura'], [0, 'c'], [2, 'Quinto Santo Salmo']]
    .map(([nivel, texto]) => ({ nivel, texto }));
  const d = A.analizar(ps).informe.datos;
  igual(d.repetidos, [{ tipo: 'lectura', numero: 3, veces: 2 }]);
  igual(d.faltantes.conjuntos, [2, 4]);
  verdad(d.fueraDeOrden.length >= 2, JSON.stringify(d.fueraDeOrden));
});

/* ---------- Marcas y fragmentos ---------- */
prueba('Marcas: autor, cierres, Canto, Todos, Aleluya', () => {
  igual(['Escrita por el Profeta San Gonzalo Pío de San Miguel', 'Escrito por el Profeta San Gonzalo Pío de San Miguel',
    'Palabra del mismo Señor Jesucristo', 'Palabra del mismo Señor Jesús', 'Palabras del mismo Señor Jesucristo',
    'Canto', 'Todos: Señor, escucha', 'Aleluya, aleluya', 'Los pescadores salieron'].map(A.tipoDeMarca),
  ['autor', 'autor', 'cierre', 'cierre', 'cierre', 'canto', 'respuesta', 'aleluya', null]);
});
prueba('Fragmentos: por párrafos, sin marcas, sin partir frases', () => {
  for (const p of analisis.piezas) for (const f of fragmentar(p, A.esMarca)) {
    verdad(!A.esMarca(f.texto.split('\n')[0]), 'fragmento empieza con marca');
    verdad(/[.!?;:»”)]$/.test(f.texto.trim()), 'fragmento corta una frase: ' + f.texto.slice(-40));
    verdad(f.texto.split(/\s+/).length <= 230, 'fragmento demasiado largo');
  }
});

/* ---------- Referencias ---------- */
prueba('Referencias que escribe el usuario', () => {
  const casos = {
    'Lect. Gonz. 145': ['lectura', 145], 'Evang. Gonz. 145': ['evangelio', 145], 'Salmo Gonz. 87': ['salmo', 87],
    'lectura 12': ['lectura', 12], 'evangelio 145': ['evangelio', 145], 'salmo 87': ['salmo', 87],
    'conjunto 300': ['conjunto', 300], 'octava lectura': ['lectura', 8], 'Octava Santa Lectura': ['lectura', 8],
    'centésimo primer salmo': ['salmo', 101], 'Introducción': ['introduccion', 0], '145': ['conjunto', 145],
  };
  for (const [q, [tipo, numero]] of Object.entries(casos)) igual(A.parsearReferencia(q), { tipo, numero }, q);
  igual(A.parsearReferencia('pescadores en la barca'), null);
});

/* ---------- Búsqueda exacta ---------- */
prueba('Búsqueda exacta: frase sin acentos ni mayúsculas, con resaltado en el texto real', () => {
  const piezas = analisis.piezas.map((p, i) => ({ ...p, id: 'x|' + p.clave, orden: i }));
  const datos = B.prepararDatos(piezas, [], A.esMarca, 384);
  const r = B.buscarExacta(datos, 'LAMPARA DEL ALFARERO ardio');
  igual(r.frase.length, 1);
  igual(r.frase[0].pieza, 'x|evangelio:145');
  const p = datos.porId.get('x|evangelio:145');
  const [a, b] = r.frase[0].intervalos[0];
  igual(p.parrafos[r.frase[0].parrafo].slice(a, b), 'lámpara del alfarero ardió');
  const f = B.fusionar(datos, r, [], { minimo: 2, maximo: 5 });
  igual(f[0].pieza, 'x|evangelio:145');
  verdad(f.length >= 1 && f.length <= 5, 'como máximo 5 resultados (sin significado puede haber uno solo)');
});
prueba('Normalización con mapa: posiciones del texto original', () => {
  const n = normalizarConMapa('¡Él  vio, la Niña!');
  igual(n.texto, ' el vio la nina ');
  igual(rangos([1, 2, 3, 5, 7, 8]), '1–3, 5, 7–8');
  igual(FRASE_UNICA.includes('alfarero'), true);
});

/* ---------- Dominus nostrum: cerebros (ninguno usa la red en esta versión) ---------- */
try {
  const { respuestaDeEjemplo, default: demo } = await import('../js/dominus/cerebros/demostracion.js');
  const { CEREBROS, CEREBRO_POR_DEFECTO, ErrorCerebro } = await import('../js/dominus/cerebros/index.js');
  const sinConectar = (await import('../js/dominus/cerebros/sin-conectar.js')).default;
  let errSC = null; try { await sinConectar.responder({ instruccion: '', fragmentos: [], mensajes: [] }); } catch (e) { errSC = e; }
  const senal = new AbortController(); senal.abort();
  let errAbort = null; try { await demo.responder({ fragmentos: [], mensajes: [], senal: senal.signal }); } catch (e) { errAbort = e; }
  prueba('Dominus nostrum: registro de cerebros («Sin conectar» por defecto, ninguno envía)', () => {
    igual(Object.keys(CEREBROS), ['sin-conectar', 'demostracion']);
    igual(CEREBRO_POR_DEFECTO, 'sin-conectar');
    igual([sinConectar.envia, demo.envia], [false, false]);
  });
  prueba('Dominus nostrum: «Sin conectar» no responde (error no-conectado)', () => {
    verdad(errSC instanceof ErrorCerebro, 'debía ser ErrorCerebro'); igual(errSC.tipo, 'no-conectado');
  });
  prueba('Dominus nostrum: la Demostración respeta la señal de aborto', () => igual(errAbort?.name, 'AbortError'));
  prueba('Dominus nostrum: la Demostración solo cita fragmentos que existen, en todos los turnos', () => {
    for (const n of [1, 2, 3, 5]) {
      const frags = Array.from({ length: n }, (_, i) => ({ n: i + 1, ref: 'R' + (i + 1), tipo: 'T', texto: 'x' }));
      for (let turno = 1; turno <= 7; turno++) {
        const msgs = Array.from({ length: turno }, (_, i) => ({ rol: 'usuario', texto: 'p' + i }));
        const t = respuestaDeEjemplo(frags, msgs), citas = [...t.matchAll(/\[(\d+)\]/g)].map(m => +m[1]);
        verdad(citas.length >= 1 && citas.every(c => c >= 1 && c <= n), `${n} fragmentos, turno ${turno}: ${t}`);
      }
    }
  });
} catch (e) { resultados.push({ nombre: 'Dominus nostrum: cargar los cerebros', ok: false, error: e.stack || e.message }); }

/* ---------- Informe ---------- */
/* ---------- Kyrien: Doctrina Gonzaleana (lee un .docx ficticio en el navegador) ---------- */
try { await (await import('./pruebas-doctrina.js')).correr(prueba, igual, verdad); }
catch (e) { resultados.push({ nombre: 'Doctrina: preparar el documento ficticio', ok: false, error: e.stack || e.message }); }

const fallos = resultados.filter(r => !r.ok);
const lista = document.getElementById('lista');
lista.innerHTML = resultados.map(r => `<li class="${r.ok ? 'ok' : 'mal'}">${r.ok ? '✔' : '✘'} ${r.nombre}${r.ok ? '' : `<pre>${r.error.replace(/</g, '&lt;')}</pre>`}</li>`).join('');
document.getElementById('resumen').textContent = fallos.length ? `${fallos.length} de ${resultados.length} pruebas fallaron` : `${resultados.length} pruebas correctas`;
document.getElementById('resumen').className = fallos.length ? 'mal' : 'ok';
window.__pruebas = { total: resultados.length, fallos };
