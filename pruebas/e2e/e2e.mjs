/* ============================================================
   Prueba de extremo a extremo de Agios con Playwright + Chromium.
   Solo para desarrollo (la app no necesita nada de esto).

   Uso:
     ESPEJO=/ruta/espejo SALIDA=/ruta/capturas JSZIP=/ruta/jszip.min.js \
       node pruebas/e2e/e2e.mjs
   ESPEJO (opcional): espejo local de jsDelivr y Hugging Face hecho con
   preparar-espejo.sh; sin él se usa la red real.
   Recorre: pruebas unitarias, errores (luz roja), procesamiento con
   interrupción y reanudación, Estructura detectada, búsqueda exacta y
   por significado, lector e índice, actualización incremental, menú,
   uso sin conexión, borrado y privacidad (ninguna petición con texto).
   ============================================================ */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciar } from './servidores.mjs';
import { generarDocumento, TEMAS } from '../generador.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const JSZip = require(process.env.JSZIP || 'jszip');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ESPEJO = process.env.ESPEJO || null;
const SALIDA = process.env.SALIDA || path.join(RAIZ, 'pruebas/e2e/salida');
mkdirSync(SALIDA, { recursive: true });
const URL_APP = 'http://localhost:8080/';

const informe = [];
let fallos = 0;
const paso = async (nombre, fn) => {
  const t0 = Date.now();
  try { const detalle = await fn(); informe.push({ nombre, ok: true, ms: Date.now() - t0, detalle }); console.log('✔', nombre, detalle ? JSON.stringify(detalle) : ''); }
  catch (e) { fallos++; informe.push({ nombre, ok: false, error: e.message }); console.log('✘', nombre, '\n   ', e.message); }
};
const verdad = (c, m) => { if (!c) throw new Error(m); };

// Documentos de prueba (texto inventado)
const docV1 = Buffer.from(await generarDocumento(JSZip));
const docV2 = Buffer.from(await generarDocumento(JSZip, { conjuntos: 372, modificar: [{ tipo: 'lectura', numero: 12 }, { tipo: 'evangelio', numero: 300 }] }));
const docSin = Buffer.from(await generarDocumento(JSZip, { sinEstructura: true }));
const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let srv = await iniciar({ raizApp: RAIZ, espejo: ESPEJO });
const env = { ...process.env }; for (const k of Object.keys(env)) if (/proxy/i.test(k)) delete env[k];
const args = ESPEJO ? ['--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1,MAP huggingface.co 127.0.0.1', '--ignore-certificate-errors', '--no-proxy-server'] : [];
const browser = await chromium.launch({ env, args });
const ctx = await browser.newContext({ ignoreHTTPSErrors: !!ESPEJO, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
const page = await ctx.newPage();
const peticiones = [];
ctx.on('request', r => peticiones.push({ url: r.url(), metodo: r.method(), cuerpo: r.postData() }));
const errores = [];
page.on('pageerror', e => errores.push(e.message));
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
page.on('dialog', d => d.accept());

const captura = nombre => page.screenshot({ path: path.join(SALIDA, nombre + '.png') });
const modo = () => page.evaluate(() => window.__agios.modo);
const estado = () => page.locator('#estado').textContent();
const esperarModo = (m, timeout = 60000) => page.waitForFunction(x => window.__agios?.modo === x, m, { timeout, polling: 50 });
async function tocarAgios() {
  const b = await page.locator('#stage').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
async function abrirApp() {
  await page.goto(URL_APP);
  await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
}
async function subir(nombre, buffer, mimeType = MIME) {
  if (await page.locator('#hoja.abierta').count()) await page.click('#cerrarHoja');
  await esperarModo('activo');
  await page.click('#btnSubir');
  await page.waitForSelector('#subir.abierta');
  await page.waitForFunction(() => window.__agios.meta.apertura === 1);
  await page.setInputFiles('#archivo', { name: nombre, mimeType, buffer });
}
async function buscar(q) {
  await esperarModo('activo');
  await page.fill('#consulta', q);
  await page.click('#btnBuscar');
  const visto = { mult: 0 };
  await page.waitForFunction(() => window.__agios.modo === 'buscando', null, { timeout: 5000, polling: 20 }).catch(() => {});
  visto.mult = await page.evaluate(() => window.__agios.meta.mult);
  await esperarModo('activo', 120000);
  const n = await page.locator('.tarjeta').count();
  if (n) await page.waitForFunction(k => document.querySelectorAll('.tarjeta.visible').length === k, n, { timeout: 10000 });
  const tarjetas = await page.$$eval('.tarjeta', ts => ts.map(t => ({
    ref: t.querySelector('.ref').textContent, tipo: t.querySelector('.tipo').textContent,
    texto: t.querySelector('p').textContent, marcado: [...t.querySelectorAll('mark')].map(m => m.textContent),
    origen: t.querySelector('.origen').textContent,
  })));
  return { tarjetas, mult: visto.mult, pista: await page.locator('#hint').textContent(), estado: await estado() };
}
const contarPend = () => page.evaluate(() => new Promise(ok => {
  const r = indexedDB.open('agios'); r.onsuccess = () => { const q = r.result.transaction('fragmentos').objectStore('fragmentos').index('pend').count(); q.onsuccess = () => ok(q.result); };
}));

/* 1 ---------------------------------------------------------------- */
await paso('Pruebas unitarias (ordinales, analizador, referencias, búsqueda exacta)', async () => {
  await page.goto(URL_APP + 'pruebas/index.html');
  await page.waitForFunction(() => window.__pruebas, null, { timeout: 30000 });
  const r = await page.evaluate(() => window.__pruebas);
  await captura('01-pruebas-unitarias');
  verdad(r.fallos.length === 0, JSON.stringify(r.fallos));
  return { total: r.total };
});

/* 2 ---------------------------------------------------------------- */
await paso('Encender / apagar tocando a Agios', async () => {
  await abrirApp();
  verdad(await modo() === 'apagado', 'debía empezar apagado');
  await captura('02-apagado');
  await tocarAgios(); await esperarModo('activo');
  await page.waitForTimeout(1200); await captura('03-activo');
  await tocarAgios(); await esperarModo('apagado');
  await tocarAgios(); await esperarModo('activo');
});

/* 3 ---------------------------------------------------------------- */
await paso('Error: archivo que no es .docx → luz roja', async () => {
  await subir('foto.jpg', Buffer.from('ÿØÿà esto no es un docx'), 'image/jpeg');
  await esperarModo('error', 20000);
  const d = await page.evaluate(() => window.__agios.destello);
  const e = await estado();
  await captura('04-error-no-docx');
  verdad(d.color === '#ff4d5e' && d.k > 0.3, 'sin destello rojo ' + JSON.stringify(d));
  verdad(/no válido/.test(e), e);
  await esperarModo('activo');
  return { estado: e };
});

await paso('Error: .docx sin estructura → luz roja y mensaje claro', async () => {
  await subir('sin-titulos.docx', docSin);
  await esperarModo('error', 30000);
  const d = await page.evaluate(() => window.__agios.destello);
  await page.waitForSelector('#hoja.abierta', { timeout: 5000 });
  const txt = await page.locator('#hojaContenido').textContent();
  await captura('05-error-sin-estructura');
  verdad(d.color === '#ff4d5e', 'sin destello rojo');
  verdad(/No se reconoció ninguna Santa Lectura/.test(txt), txt.slice(0, 200));
  await page.click('#cerrarHoja');
  await esperarModo('activo');
});

/* 4 ---------------------------------------------------------------- */
let pctAntes = 0, pctDespues = null;
await paso('Procesar el documento de prueba (x3 + temblor, avance en el estado)', async () => {
  await subir('FICTICIO-documento-de-prueba.docx', docV1);
  await esperarModo('procesando', 10000);
  const m = await page.evaluate(() => window.__agios.meta);
  verdad(m.mult === 3 && m.temblor === 1 && m.apertura === 0, 'coreografía de procesamiento ' + JSON.stringify(m));
  await page.waitForFunction(() => /procesando (\d+)% · \d+\/1107 piezas/.test(document.getElementById('estado').textContent) &&
    +document.getElementById('estado').textContent.match(/(\d+)%/)[1] >= 20, null, { timeout: 600000, polling: 100 });
  const e = await estado();
  pctAntes = +e.match(/(\d+)%/)[1];
  await captura('06-procesando');
  return { estado: e, pista: await page.locator('#hint').textContent() };
});

await paso('Interrupción (recargar a mitad) → continúa donde se quedó', async () => {
  const pendAntes = await contarPend();
  await page.reload();
  await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
  await esperarModo('procesando', 15000);
  await page.waitForFunction(() => /procesando \d+%/.test(document.getElementById('estado').textContent), null, { timeout: 120000, polling: 50 });
  pctDespues = +(await estado()).match(/(\d+)%/)[1];
  await captura('07-reanudando');
  verdad(pctDespues >= pctAntes - 1, `empezó de cero: ${pctAntes}% → ${pctDespues}%`);
  await page.waitForFunction(() => ['exito', 'activo'].includes(window.__agios.modo), null, { timeout: 900000, polling: 100 });
  const d = await page.evaluate(() => window.__agios.destello);
  verdad(d.color === '#3ddc84', 'sin luz verde');
  await captura('08-listo-luz-verde');
  verdad(await contarPend() === 0, 'quedaron fragmentos pendientes');
  return { pctAntes, pctDespues, pendientesAlInterrumpir: pendAntes };
});

await paso('Estructura detectada', async () => {
  await esperarModo('activo');
  await page.click('#btnMenu');
  await page.waitForSelector('#hoja.abierta');
  await page.click('button[data-accion="estructura"]');
  await page.waitForFunction(() => document.getElementById('hojaTitulo').textContent === 'Estructura detectada');
  const t = await page.locator('#hojaContenido').textContent();
  await captura('09-estructura-detectada');
  for (const x of ['371Conjuntos', '371Santas Lecturas', '371Santos Salmos', '365Santos Evangelios', '89–94 (6)', 'Nota del copista', 'Conjunto 1', 'Conjunto 371'])
    verdad(t.includes(x), 'falta «' + x + '»');
  await page.click('#cerrarHoja');
});

/* 5 ---------------------------------------------------------------- */
await paso('Búsqueda exacta por referencia: «Lect. Gonz. 145» (x2 mientras busca)', async () => {
  const r = await buscar('Lect. Gonz. 145');
  await captura('10-referencia');
  verdad(r.mult === 2, 'no aceleró a x2: ' + r.mult);
  verdad(r.tarjetas[0].ref === 'Lect. Gonz. 145', JSON.stringify(r.tarjetas.map(t => t.ref)));
  verdad(r.tarjetas.length >= 2 && r.tarjetas.length <= 5, 'entre 2 y 5');
  return r.tarjetas.map(t => t.ref);
});
await paso('Referencias: «octava lectura», «salmo 87», «Evang. Gonz. 16», «conjunto 300», «Evang. Gonz. 90»', async () => {
  const a = await buscar('octava lectura'); verdad(a.tarjetas[0].ref === 'Lect. Gonz. 8', a.tarjetas[0]?.ref);
  const b = await buscar('salmo 87'); verdad(b.tarjetas[0].ref === 'Salmo Gonz. 87', b.tarjetas[0]?.ref);
  const c = await buscar('Evang. Gonz. 16'); verdad(c.tarjetas[0].tipo === 'Santo Evangelio de Jesucristo', c.tarjetas[0]?.tipo);
  const d = await buscar('conjunto 300'); verdad(d.tarjetas.map(t => t.ref).join() === 'Lect. Gonz. 300,Salmo Gonz. 300,Evang. Gonz. 300', d.tarjetas.map(t => t.ref).join());
  const e = await buscar('Evang. Gonz. 90'); verdad(e.tarjetas.length === 0 && /No existe/.test(e.pista), e.pista);
  const s = await buscar('Salmo Gonz. 2'); verdad(s.tarjetas[0].tipo === 'Santo Salmo de Súplica', s.tarjetas[0]?.tipo);
  return { conjunto300: d.tarjetas.length, evang90: e.pista, salmo2: s.tarjetas[0].tipo };
});
await paso('Búsqueda exacta de frase sin acentos ni mayúsculas, con resaltado', async () => {
  const r = await buscar('LAMPARA DEL ALFARERO');
  await captura('11-frase-exacta');
  verdad(r.tarjetas[0].ref === 'Evang. Gonz. 145', r.tarjetas[0]?.ref);
  verdad(r.tarjetas[0].marcado.includes('lámpara del alfarero'), JSON.stringify(r.tarjetas[0].marcado));
  verdad(/exacta/.test(r.tarjetas[0].origen), r.tarjetas[0].origen);
  verdad(r.tarjetas.length >= 2 && r.tarjetas.length <= 5, 'entre 2 y 5: ' + r.tarjetas.length);
  return { n: r.tarjetas.length, primero: r.tarjetas[0].ref };
});

/* 6 ---------------------------------------------------------------- */
const temaDeTexto = t => Object.entries(TEMAS).find(([, frases]) => frases.some(f => t.includes(f.slice(0, 30))))?.[0];
const CONSULTAS = [
  ['mar', 'hombres que lanzan mallas desde un bote para capturar pescado'],
  ['pastor', 'el cuidador de corderos que va tras el animal extraviado'],
  ['sanacion', 'una persona postrada por la enfermedad recupera la salud'],
  ['casa', 'edificar una vivienda sobre piedra firme para resistir el temporal'],
  ['invierno', 'calentarse junto a las llamas cuando hiela'],
];
await paso('Búsqueda por significado (sin palabras en común con el texto)', async () => {
  const out = [];
  for (const [tema, q] of CONSULTAS) {
    const r = await buscar(q);
    if (tema === 'mar') await captura('12-por-significado');
    verdad(r.tarjetas.length >= 2 && r.tarjetas.length <= 5, `${q}: ${r.tarjetas.length} resultados`);
    const temas = r.tarjetas.map(t => temaDeTexto(t.texto));
    verdad(temas[0] === tema, `«${q}» → primer resultado de tema ${temas[0]} (${r.tarjetas[0].ref}): ${r.tarjetas[0].texto.slice(0, 120)}`);
    verdad(r.tarjetas[0].marcado.length > 0, 'sin resaltado');
    out.push({ q, tema, temas, primero: r.tarjetas[0].ref, origen: r.tarjetas[0].origen });
  }
  return out;
});

/* 7 ---------------------------------------------------------------- */
await paso('Lector: Ver completo, anterior/siguiente, saltar Lectura/Salmo/Evangelio, índice', async () => {
  await buscar('lampara del alfarero');
  await page.locator('.tarjeta').first().locator('button').click();
  await page.waitForSelector('#lector.abierto');
  const titulo = () => page.locator('#lectorTitulo').textContent();
  verdad((await titulo()).startsWith('Evang. Gonz. 145'), await titulo());
  verdad(await page.locator('#lectorTexto mark').count() > 0, 'sin resaltado en el lector');
  verdad(await page.locator('#lectorTexto p.m-autor').count() === 1 && await page.locator('#lectorTexto p.m-cierre').count() === 1, 'marcas no conservadas');
  await captura('13-lector');
  await page.click('#lecAnterior'); verdad((await titulo()).startsWith('Evang. Gonz. 144'), await titulo());
  await page.click('#lecTipos button[data-tipo="lectura"]'); verdad((await titulo()).startsWith('Lect. Gonz. 144'), await titulo());
  await page.click('#lecTipos button[data-tipo="salmo"]'); verdad((await titulo()).startsWith('Salmo Gonz. 144'), await titulo());
  verdad(await page.locator('#lectorTexto p.m-respuesta').count() === 2 && await page.locator('#lectorTexto p.m-canto').count() === 1, 'marcas del salmo');
  await page.click('#lecSiguiente'); verdad((await titulo()).startsWith('Salmo Gonz. 145'), await titulo());
  await page.click('#lecIndice');
  await page.waitForSelector('#hoja.abierta .rejilla');
  await captura('14-indice');
  const nBotones = await page.locator('.rejilla button').count();
  verdad(nBotones === 371, 'índice con ' + nBotones);
  await page.click('.rejilla button:text-is("89")');
  verdad((await titulo()).startsWith('Lect. Gonz. 89'), await titulo());
  verdad(await page.locator('#lecTipos button[data-tipo="evangelio"]').isDisabled(), 'Evangelio 89 debía estar deshabilitado');
  await page.click('#lecIndice'); await page.fill('#irA', 'evangelio 88'); await page.press('#irA', 'Enter');
  verdad((await titulo()).startsWith('Evang. Gonz. 88'), await titulo());
  await page.click('#lecSiguiente'); verdad((await titulo()).startsWith('Evang. Gonz. 95'), 'tras el 88 debía seguir el 95: ' + await titulo());
  await page.click('#lecIndice'); await page.click('#hojaContenido button:text-is("Introducción")');
  verdad((await titulo()).startsWith('Introducción'), await titulo());
  await page.click('#cerrarLector');
});

/* 8 ---------------------------------------------------------------- */
await paso('Actualización incremental: solo se procesan las piezas nuevas o modificadas', async () => {
  const antes = srv.registro.length;
  await subir('FICTICIO-documento-de-prueba-v2.docx', docV2);
  await esperarModo('procesando', 10000);
  await page.waitForFunction(() => /de 5 pieza/.test(document.getElementById('hint').textContent), null, { timeout: 60000, polling: 50 });
  const pista = await page.locator('#hint').textContent();
  await page.waitForFunction(() => window.__agios.modo !== 'procesando', null, { timeout: 300000 });
  await page.waitForSelector('#hoja.abierta', { timeout: 5000 });
  const t = await page.locator('#hojaContenido').textContent();
  await captura('15-actualizacion');
  verdad(/3 nuevas · 2 modificadas · 1106 sin cambios · 0 eliminadas/.test(t), t.slice(0, 400));
  verdad(t.includes('372Conjuntos'), 'debía haber 372 conjuntos');
  await page.click('#cerrarHoja');
  const nuevas = srv.registro.slice(antes).filter(r => r.host !== 'localhost');
  const r = await buscar('Esta frase fue agregada en la versión nueva');
  const refs = r.tarjetas.map(x => x.ref);
  verdad(refs.includes('Lect. Gonz. 12') && refs.includes('Evang. Gonz. 300'), JSON.stringify(refs));
  return { pista, descargasNuevas: nuevas.length, refs };
});

/* 9 ---------------------------------------------------------------- */
await paso('Menú: documentos cargados, espacio usado, almacenamiento persistente', async () => {
  await page.click('#btnMenu');
  await page.waitForSelector('#hoja.abierta .doc');
  const t = await page.locator('#hojaContenido').textContent();
  await captura('16-menu');
  verdad(/FICTICIO-documento-de-prueba-v2\.docx/.test(t) && /Espacio usado/.test(t) && /persistente/.test(t), t.slice(0, 300));
  await page.click('#cerrarHoja');
  return { extracto: t.replace(/\s+/g, ' ').slice(0, 260) };
});

/* 10 --------------------------------------------------------------- */
await paso('Sin conexión: se apagan todos los servidores y la app sigue funcionando', async () => {
  verdad(await page.evaluate(() => !!navigator.serviceWorker.controller), 'el service worker no controla la página');
  await srv.cerrar();
  const registroPrevio = srv.registro;
  await page.reload();
  await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
  await tocarAgios(); await esperarModo('activo');
  const a = await buscar('lampara del alfarero');
  verdad(a.tarjetas[0]?.ref === 'Evang. Gonz. 145', 'exacta sin conexión: ' + a.tarjetas[0]?.ref);
  const b = await buscar('hombres que lanzan mallas desde un bote para capturar pescado');
  verdad(temaDeTexto(b.tarjetas[0]?.texto || '') === 'mar' && /significado/.test(b.tarjetas[0].origen), 'significado sin conexión: ' + JSON.stringify(b.tarjetas[0]));
  await captura('17-sin-conexion');
  srv = await iniciar({ raizApp: RAIZ, espejo: ESPEJO });
  srv.registro.unshift(...registroPrevio);
  return { exacta: a.tarjetas[0].ref, significado: b.tarjetas[0].ref };
});

/* 11 --------------------------------------------------------------- */
await paso('Borrar la colección desde el menú', async () => {
  await page.click('#btnMenu');
  await page.waitForSelector('button[data-accion="borrar"]');
  await page.click('button[data-accion="borrar"]');
  await page.waitForFunction(() => !document.querySelector('button[data-accion="borrar"]'));
  const n = await page.evaluate(() => new Promise(ok => { const r = indexedDB.open('agios'); r.onsuccess = () => { const q = r.result.transaction('piezas').objectStore('piezas').count(); q.onsuccess = () => ok(q.result); }; }));
  await captura('18-borrado');
  verdad(n === 0, 'quedaron ' + n + ' piezas');
  await page.click('#cerrarHoja');
});

/* 12 --------------------------------------------------------------- */
await paso('Privacidad: ninguna petición lleva texto del documento', async () => {
  const hosts = new Set(['localhost:8080', 'cdn.jsdelivr.net', 'huggingface.co']);
  const malas = peticiones.filter(p => {
    const u = new URL(p.url);
    if (u.protocol === 'blob:' || u.protocol === 'data:') return false;
    return p.metodo !== 'GET' || p.cuerpo || !hosts.has(u.host) || /alfarero|pescadores|Santa%20Lectura/i.test(p.url);
  });
  const servidor = srv.registro.filter(r => r.metodo !== 'GET' || r.bytesCuerpo > 0);
  verdad(!malas.length, JSON.stringify(malas.slice(0, 5)));
  verdad(!servidor.length, JSON.stringify(servidor.slice(0, 5)));
  const externos = [...new Set(srv.registro.filter(r => r.host !== 'localhost').map(r => r.host + r.ruta))];
  return { peticionesNavegador: peticiones.length, externos };
});

await paso('Sin errores en la consola', async () => {
  const reales = errores.filter(e => !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(e));
  verdad(!reales.length, JSON.stringify(reales.slice(0, 5)));
  return { ignorados: errores.length - reales.length };
});

await browser.close();
await srv.cerrar();
writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 2));
console.log(`\n${informe.length - fallos}/${informe.length} pasos correctos. Capturas en ${SALIDA}`);
process.exit(fallos ? 1 : 0);
