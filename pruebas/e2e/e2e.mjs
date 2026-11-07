/* ============================================================
   Prueba de extremo a extremo de Anesthios con Playwright + Chromium.
   Solo para desarrollo (la app no necesita nada de esto).

   Uso:
     ESPEJO=/ruta/espejo SALIDA=/ruta/capturas JSZIP=/ruta/jszip.min.js \
       [VERSION_ANTERIOR=7fb3874] node pruebas/e2e/e2e.mjs
   ESPEJO (opcional): espejo local de jsDelivr y Hugging Face hecho con
   preparar-espejo.sh; sin él se usa la red real.
   VERSION_ANTERIOR: commit de la versión publicada antes (Agios) para la
   prueba de actualización sin pérdida de datos. Por omisión, 7fb3874
   (main antes de Anesthios).

   Recorre:
   A. Actualización sin pérdida de datos: la versión anterior procesa el
      documento; se publica la nueva en el mismo origen (service worker
      actualizado) y, SIN subir nada, siguen funcionando estructura,
      búsquedas, lector y paneles («Documento» con la fecha guardada).
   B. Interfaz Anesthios: nombre, título del asistente, paneles reales,
      ventanas (✕, cerrar todas, acumular, mover, no duplicar),
      sugerencias recientes, apagar cierra todo, subir no cierra.
   C. Lo de siempre: pruebas unitarias, errores (luz roja), procesamiento
      con interrupción y reanudación, Estructura detectada, búsqueda
      exacta y por significado, lector e índice, actualización
      incremental, menú, sin conexión, borrado y privacidad.
   D. Capturas en celular y tableta (vertical y horizontal) junto a las
      del prototipo para comparar.
   ============================================================ */
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import os from 'node:os';
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
const VERSION_ANTERIOR = process.env.VERSION_ANTERIOR || '7fb3874';
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

// La versión anterior, tal cual está en git
const DIR_ANTERIOR = mkdtempSync(path.join(os.tmpdir(), 'anesthios-anterior-'));
execSync(`git -C "${RAIZ}" archive ${VERSION_ANTERIOR} | tar -x -C "${DIR_ANTERIOR}"`);

let srv = await iniciar({ raizApp: DIR_ANTERIOR, espejo: ESPEJO });
const env = { ...process.env }; for (const k of Object.keys(env)) if (/proxy/i.test(k)) delete env[k];
const args = ESPEJO ? ['--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1,MAP huggingface.co 127.0.0.1', '--ignore-certificate-errors', '--no-proxy-server'] : [];
const browser = await chromium.launch({ env, args });
const ctx = await browser.newContext({ ignoreHTTPSErrors: !!ESPEJO, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const peticiones = [];
ctx.on('request', r => peticiones.push({ url: r.url(), metodo: r.method(), cuerpo: r.postData() }));
const errores = [];
page.on('pageerror', e => errores.push(e.message));
page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
page.on('dialog', d => d.accept());
let cargas = 0; page.on('load', () => { cargas++; });

const captura = nombre => page.screenshot({ path: path.join(SALIDA, nombre + '.png') });
const modo = () => page.evaluate(() => window.__agios.modo);
const estado = () => page.locator('#estado').textContent();
const texto = sel => page.locator(sel).textContent();
const esperarModo = (m, timeout = 60000) => page.waitForFunction(x => window.__agios?.modo === x, m, { timeout, polling: 50 });
/** Toca a Agios en un punto visible del modelo (no tapado por ventanas). */
async function tocarAgios() {
  const p = await page.evaluate(() => {
    const st = document.getElementById('stage').getBoundingClientRect();
    const cx = st.left + st.width / 2, cy = st.top + st.height * 0.5;
    for (let r = 0; r < Math.max(st.width, st.height) * 0.5; r += 6)
      for (let a = 0; a < 6.28; a += 0.4) {
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        if (document.elementFromPoint(x, y)?.classList.contains('escena')) return { x, y };
      }
    return { x: cx, y: cy };
  });
  await page.mouse.click(p.x, p.y);
}
/** Cierra con su ✕ la ventana indicada (aunque otra en cascada la tape en parte). */
const cerrarVentana = corta => page.$eval(`.tarjeta[data-corta="${corta}"]:not(.cerrando) .x`, b => b.click());
/** «Ver completo» de la ventana n (aunque otra la tape en parte). */
const verCompleto = (n = 0) => page.$$eval('.tarjeta:not(.cerrando) .ver', (bs, i) => bs[i].click(), n);
async function abrirApp() {
  await page.goto(URL_APP);
  await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
}
async function encender() {
  if (await modo() === 'apagado') { await tocarAgios(); }
  await esperarModo('activo');
}
async function subir(nombre, buffer, mimeType = MIME) {
  if (await page.locator('#hoja.abierta').count()) await page.click('#cerrarHoja');
  await esperarModo('activo');
  await page.click('#btnSubir');
  await page.waitForSelector('#subir.abierta');
  await page.waitForFunction(() => window.__agios.meta.apertura === 1);
  await page.setInputFiles('#archivo', { name: nombre, mimeType, buffer });
}
const vivas = () => page.$$eval('.tarjeta:not(.cerrando)', ts => ts.map(t => ({
  pieza: t.dataset.pieza, corta: t.dataset.corta, ref: t.querySelector('.ref').textContent, tipo: t.querySelector('.tipo').textContent,
  texto: t.querySelector('p').textContent, marcado: [...t.querySelectorAll('mark')].map(m => m.textContent),
  origen: t.querySelector('.origen')?.textContent || '', z: +t.style.zIndex, x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight,
  visible: t.classList.contains('visible'), destella: t.classList.contains('destella'),
})));
const esperarSinVentanas = () => page.waitForFunction(() => !document.querySelector('.tarjeta'), null, { timeout: 5000 });
async function cerrarVentanas() {
  const n = (await vivas()).length;
  if (n > 1) await page.click('#cerrarTodas');
  else if (n === 1) await page.click('.tarjeta .x');
  if (n) await esperarSinVentanas();
}
/** Busca (por omisión cerrando antes las ventanas abiertas) y devuelve las ventanas NUEVAS en orden. */
async function buscar(q, { acumular = false } = {}) {
  await esperarModo('activo');
  if (!acumular) await cerrarVentanas();
  const antes = new Set((await vivas()).map(v => v.pieza));
  await page.fill('#consulta', q);
  await page.click('#btnBuscar');
  await page.waitForFunction(() => window.__agios.modo === 'buscando', null, { timeout: 5000, polling: 20 }).catch(() => {});
  const mult = await page.evaluate(() => window.__agios.meta.mult);
  await esperarModo('activo', 120000);
  await page.waitForFunction(() => [...document.querySelectorAll('.tarjeta:not(.cerrando)')].every(t => t.classList.contains('visible')), null, { timeout: 10000 });
  const todas = await vivas();
  return { tarjetas: todas.filter(t => !antes.has(t.pieza)), todas, mult, pista: await texto('#hint'), estado: await estado() };
}
const contarPend = () => page.evaluate(() => new Promise(ok => {
  const r = indexedDB.open('agios'); r.onsuccess = () => { const q = r.result.transaction('fragmentos').objectStore('fragmentos').index('pend').count(); q.onsuccess = () => ok(q.result); };
}));
const huellaDatos = () => page.evaluate(() => new Promise(ok => {
  const r = indexedDB.open('agios');
  r.onsuccess = () => {
    const db = r.result, tx = db.transaction(['colecciones', 'piezas', 'fragmentos']), out = { version: db.version };
    tx.objectStore('piezas').count().onsuccess = e => { out.piezas = e.target.result; };
    tx.objectStore('fragmentos').count().onsuccess = e => { out.fragmentos = e.target.result; };
    tx.objectStore('fragmentos').index('pend').count().onsuccess = e => { out.pendientes = e.target.result; };
    tx.objectStore('colecciones').get('lecturas').onsuccess = e => { const c = e.target.result; out.actualizado = c?.actualizado; out.conjuntos = c?.informe?.datos?.conjuntos; out.documento = c?.documento?.nombre; };
    tx.oncomplete = () => ok(out);
  };
}));
const temaDeTexto = t => Object.entries(TEMAS).find(([, frases]) => frases.some(f => t.includes(f.slice(0, 30))))?.[0];

/* ================================================================
   A. ACTUALIZACIÓN SIN PÉRDIDA DE DATOS (punto 0)
   ================================================================ */
let huellaAntes = null, registroAlCambiar = 0;
await paso(`A1. Versión anterior (${VERSION_ANTERIOR}): procesar el documento de prueba`, async () => {
  await abrirApp();
  verdad(!(await page.$('.titulo-col')), 'debía ser la versión anterior');
  await tocarAgios(); await esperarModo('activo');
  await subir('FICTICIO-documento-de-prueba.docx', docV1);
  await esperarModo('procesando', 10000);
  await page.waitForFunction(() => window.__agios.modo !== 'procesando', null, { timeout: 900000, polling: 200 });
  await page.waitForFunction(() => window.__agios.modo === 'activo', null, { timeout: 10000 });
  if (await page.locator('#hoja.abierta').count()) await page.click('#cerrarHoja');
  huellaAntes = await huellaDatos();
  await captura('A1-version-anterior-procesada');
  verdad(huellaAntes.piezas === 1108 && huellaAntes.pendientes === 0 && huellaAntes.conjuntos === 371, JSON.stringify(huellaAntes));
  return huellaAntes;
});

await paso('A2. Se publica Anesthios en el mismo origen: el service worker se actualiza', async () => {
  // La versión anterior ya está instalada y controlando la página.
  await page.reload(); await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
  verdad(await page.evaluate(() => !!navigator.serviceWorker.controller), 'la versión anterior no tenía service worker activo');
  srv.cambiarRaiz(RAIZ);
  registroAlCambiar = srv.registro.length;
  // El usuario abre la app: se ve todavía la versión anterior (desde su caché) y el
  // navegador, por su cuenta, descubre e instala el service worker nuevo.
  const t0 = Date.now();
  await page.reload(); await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
  verdad(!(await page.$('.titulo-col')), 'esperaba aún la versión anterior');
  // Instalada Y activada: la caché nueva existe y la anterior de la APP ya se borró.
  // El navegador comprueba por su cuenta si hay service worker nuevo (con demora
  // variable). Si en 90 s no lo hizo, se le pide la misma comprobación que hace
  // en su ciclo normal (registration.update()); el informe dice cuál ocurrió.
  let forzada = false;
  for (let k = 0; ; k++) {
    const c = await page.evaluate(() => caches.keys());
    if (c.includes('agios-app-v2') && !c.includes('agios-app-v1')) break;
    if (k === 90) { forzada = true; await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update())); }
    verdad(k < 240, 'el service worker nuevo no se activó: ' + c + ' · peticiones de sw.js: ' +
      srv.registro.slice(registroAlCambiar).filter(r => r.ruta === '/sw.js').length);
    await page.waitForTimeout(1000);
  }
  const segundos = Math.round((Date.now() - t0) / 1000);
  // La siguiente vez que abre la app, ya es Anesthios.
  await page.reload(); await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
  const intentos = segundos;
  verdad(await page.$('.titulo-col'), 'la versión nueva no llegó');
  const cachés = await page.evaluate(() => caches.keys());
  verdad(cachés.includes('agios-app-v2') && !cachés.includes('agios-app-v1'), 'cachés de la app: ' + cachés);
  verdad(cachés.includes('transformers-cache'), 'se perdió la caché del modelo: ' + cachés);
  verdad(cachés.includes('agios-cdn-v1'), 'se perdió la caché de librerías: ' + cachés);
  return { segundosHastaActivarse: intentos, comprobacion: forzada ? 'registration.update()' : 'automática del navegador', cachés };
});

await paso('A3. Sin subir nada: los datos siguen ahí, intactos', async () => {
  const h = await huellaDatos();
  verdad(JSON.stringify(h) === JSON.stringify(huellaAntes), `antes ${JSON.stringify(huellaAntes)} · después ${JSON.stringify(h)}`);
  await encender();
  await page.waitForTimeout(800);
  const panel = { conjuntos: await texto('#dConjuntos'), indice: await texto('#dIndice'), documento: await texto('#dDoc'), hora: await texto('#dHora') };
  await captura('A3-anesthios-con-datos-anteriores');
  verdad(panel.conjuntos === '371', 'Conjuntos: ' + panel.conjuntos);
  verdad(panel.indice === '● listo', 'Índice: ' + panel.indice);
  verdad(/^(ahora|hace \d+ min|hoy \d)/.test(panel.documento), 'Documento: ' + panel.documento);
  verdad(await modo() === 'activo' && !(await page.locator('#hoja.abierta').count()), 'no debía reprocesar nada');
  return { ...h, panel };
});

await paso('A4. Sin subir nada: estructura, búsqueda exacta, por significado y lector', async () => {
  await page.click('#btnMenu'); await page.waitForSelector('#hoja.abierta');
  await page.click('button[data-accion="estructura"]');
  await page.waitForFunction(() => document.getElementById('hojaTitulo').textContent === 'Estructura detectada');
  const t = await texto('#hojaContenido');
  verdad(t.includes('371Conjuntos') && t.includes('365Santos Evangelios') && t.includes('89–94 (6)'), t.slice(0, 200));
  await page.click('#cerrarHoja');
  const a = await buscar('Lect. Gonz. 145');
  verdad(a.tarjetas[0]?.ref === 'Lect. Gonz. 145', 'exacta: ' + a.tarjetas[0]?.ref);
  const b = await buscar('hombres que lanzan mallas desde un bote para capturar pescado');
  verdad(temaDeTexto(b.tarjetas[0]?.texto || '') === 'mar' && /significado/.test(b.tarjetas[0].origen), 'significado: ' + JSON.stringify(b.tarjetas[0]));
  await verCompleto(0);
  await page.waitForSelector('#lector.abierto');
  const titulo = await texto('#lectorTitulo');
  await page.click('#cerrarLector');
  const modelo = srv.registro.slice(registroAlCambiar).filter(r => r.host === 'huggingface.co');
  verdad(!modelo.length, 'volvió a descargar el modelo: ' + modelo.map(r => r.ruta));
  return { exacta: a.tarjetas[0].ref, significado: b.tarjetas[0].ref, lector: titulo, descargasDelModelo: modelo.length };
});

/* ================================================================
   B. INTERFAZ ANESTHIOS
   ================================================================ */
await paso('B1. Nombre de la app y título del asistente', async () => {
  await cerrarVentanas();
  const titulo = await page.title();
  const marca = (await texto('.marca')).trim();
  const manifiesto = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  verdad(titulo === 'Anesthios', 'title: ' + titulo);
  verdad(marca.startsWith('ANESTHIOS') && marca.includes('ASISTENTES GONZALEANOS'), marca);
  verdad(manifiesto.name === 'Anesthios' && manifiesto.short_name === 'Anesthios' && manifiesto.background_color === '#07070d', JSON.stringify(manifiesto));
  verdad(await texto('#nombreAsistente') === 'AGIOS' && await texto('#subtituloAsistente') === 'LECTURAS Y EVANGELIOS', 'título del asistente');
  verdad(!(await page.locator('#tituloCol.apagado').count()) && await page.locator('#chip.on').count(), 'encendido: título brillante y punto morado');
  await tocarAgios(); await esperarModo('apagado');
  await page.waitForFunction(() => document.getElementById('dEnergia').textContent === '0%', null, { timeout: 8000 }).catch(() => {});
  verdad(await page.locator('#tituloCol.apagado').count() && !(await page.locator('#chip.on').count()), 'apagado: título gris y punto gris');
  verdad(await texto('#dEnergia') === '0%', 'energía apagado: ' + await texto('#dEnergia'));
  verdad(await page.evaluate(() => getComputedStyle(document.getElementById('chip')).whiteSpace) === 'nowrap', 'el chip se puede partir');
  await captura('B1-apagado');
  await tocarAgios(); await esperarModo('activo');
  await page.waitForFunction(() => document.getElementById('dEnergia').textContent === '100%', null, { timeout: 8000 }).catch(() => {});
  verdad(await texto('#dEnergia') === '100%', 'energía encendido: ' + await texto('#dEnergia'));
  verdad(/^\d{1,2}:\d{2}/.test(await texto('#dHora')), 'hora');
  const fuentes = await page.evaluate(async () => { await document.fonts.ready; await document.fonts.load("600 20px 'Rajdhani'"); await document.fonts.load("500 11px 'JetBrains Mono'"); return [document.fonts.check("600 20px 'Rajdhani'"), document.fonts.check("500 11px 'JetBrains Mono'")]; });
  verdad(fuentes.every(Boolean), 'tipografías no cargadas: ' + fuentes);
  return { titulo, marca, manifiesto: manifiesto.name, fuentes };
});

await paso('B2. Sugerencias: ejemplos cuando aún no hay búsquedas, e Índice', async () => {
  await page.evaluate(() => localStorage.removeItem('anesthios.recientes'));
  await page.reload(); await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
  await encender();
  const sug = await page.$$eval('#recientes button', bs => bs.map(b => b.textContent));
  verdad(sug.join('|') === 'Evang. Gonz. 145|salmo 87|la misericordia del Padre', 'sugerencias: ' + sug);
  verdad(!(await page.locator('#cerrarTodas.ver').count()), '«Cerrar todas» no debía verse sin ventanas');
  await page.click('#sugIndice');
  await page.waitForSelector('#hoja.abierta .rejilla');
  await page.click('#cerrarHoja');
  return { sug };
});

await paso('B3. Ventanas se acumulan: 23 → cerrar S y E → 24 → cerrar S y E → quedan L·23 y L·24', async () => {
  await cerrarVentanas();
  const a = await buscar('Lect. Gonz. 23');
  verdad(a.tarjetas.map(t => t.corta).join() === 'L·23,S·23,E·23', a.tarjetas.map(t => t.corta).join());
  verdad(await page.locator('#cerrarTodas.ver').count(), '«Cerrar todas» debía verse con 3 ventanas');
  verdad(await texto('#dAbiertas') === '3', 'panel Abiertas: ' + await texto('#dAbiertas'));
  await captura('B3a-tres-ventanas');
  for (const c of ['S·23', 'E·23']) await cerrarVentana(c);
  await page.waitForFunction(() => document.querySelectorAll('.tarjeta').length === 1);
  verdad(!(await page.locator('#cerrarTodas.ver').count()), '«Cerrar todas» no debía verse con 1 ventana');
  const b = await buscar('Lect. Gonz. 24', { acumular: true });
  verdad(b.tarjetas.map(t => t.corta).join() === 'L·24,S·24,E·24', b.tarjetas.map(t => t.corta).join());
  verdad(b.todas.length === 4, 'debían acumularse 4: ' + b.todas.length);
  for (const c of ['S·24', 'E·24']) await cerrarVentana(c);
  await page.waitForFunction(() => document.querySelectorAll('.tarjeta').length === 2);
  const v = await vivas();
  const lista = await page.$$eval('#dLista span', s => s.map(x => x.textContent));
  await captura('B3b-quedan-L23-L24');
  verdad(v.map(t => t.corta).join() === 'L·23,L·24', v.map(t => t.corta).join());
  verdad(lista.join() === 'L·23,L·24' && await texto('#dAbiertas') === '2', 'panel: ' + lista + ' / ' + await texto('#dAbiertas'));
  const [p, q] = v;
  const solapan = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
  verdad(!solapan, 'la ventana nueva tapó a la anterior');
  return { panel: lista, posiciones: v.map(t => [t.corta, t.x, t.y]) };
});

await paso('B4. No duplicar: buscar una pieza ya abierta la trae al frente y destella', async () => {
  const antes = await vivas();
  const r = await buscar('Lect. Gonz. 23', { acumular: true });
  const v = await vivas();
  const l23 = v.find(t => t.corta === 'L·23');
  verdad(v.filter(t => t.corta === 'L·23').length === 1, 'se duplicó L·23');
  verdad(l23.destella && l23.z === Math.max(...v.map(t => t.z)), 'L·23 no pasó al frente / no destelló');
  // Salmo y Evangelio 23 se abren como nuevas (no estaban abiertas)
  verdad(r.tarjetas.map(t => t.corta).join() === 'S·23,E·23', r.tarjetas.map(t => t.corta).join());
  for (const c of ['S·23', 'E·23']) await cerrarVentana(c);
  await page.waitForFunction(n => document.querySelectorAll('.tarjeta').length === n, antes.length);
  return { abiertas: (await vivas()).map(t => t.corta) };
});

await paso('B5. Mover ventanas (mouse y dedo) sin girar ni apagar a Agios; la tocada pasa al frente', async () => {
  await page.waitForTimeout(1200);                   // que se detenga cualquier inercia
  const rot0 = (await page.evaluate(() => window.__agios.S)).rot;
  const card = page.locator('.tarjeta[data-corta="L·23"]');
  const ini = await vivas();
  const a0 = ini.find(t => t.corta === 'L·23');
  const cab = await card.locator('.cab .ref').boundingBox();
  await page.mouse.move(cab.x + 10, cab.y + cab.height / 2);
  await page.mouse.down();
  await page.mouse.move(cab.x + 70, cab.y + cab.height / 2 + 140, { steps: 10 });
  await page.mouse.up();
  let v = await vivas(); const a1 = v.find(t => t.corta === 'L·23');
  verdad(Math.abs(a1.x - a0.x - 60) <= 2 && Math.abs(a1.y - a0.y - 140) <= 2, `mouse: ${a0.x},${a0.y} → ${a1.x},${a1.y}`);
  verdad(a1.z === Math.max(...v.map(t => t.z)), 'no pasó al frente');
  // Con el dedo (eventos táctiles reales de Chromium)
  const cdp = await ctx.newCDPSession(page);
  const b0 = v.find(t => t.corta === 'L·24');
  const cab2 = await page.locator('.tarjeta[data-corta="L·24"] .cab .ref').boundingBox();
  const x = cab2.x + 10, y = cab2.y + cab2.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let k = 1; k <= 10; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 4 * k, y: y + 9 * k }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  v = await vivas(); const b1 = v.find(t => t.corta === 'L·24');
  verdad(Math.abs(b1.x - b0.x + 40) <= 3 && Math.abs(b1.y - b0.y - 90) <= 3, `dedo: ${b0.x},${b0.y} → ${b1.x},${b1.y}`);
  verdad(b1.z === Math.max(...v.map(t => t.z)), 'la tocada con el dedo no pasó al frente');
  // No se sale de la zona (con la que quedó al frente, L·24)
  const cab3 = await page.locator('.tarjeta[data-corta="L·24"] .cab .ref').boundingBox();
  await page.mouse.move(cab3.x + 10, cab3.y + cab3.height / 2); await page.mouse.down();
  await page.mouse.move(cab3.x + 3000, cab3.y + 3000, { steps: 4 }); await page.mouse.up();
  const zona = await page.locator('#zona').boundingBox();
  const lim = (await vivas()).find(t => t.corta === 'L·24');
  verdad(lim.x <= zona.width - 60 && lim.y <= zona.height - 40, 'se salió de la zona');
  const rot1 = (await page.evaluate(() => window.__agios.S)).rot;
  verdad(Math.abs(rot1 - rot0) < 1e-6, `Agios giró: ${rot0} → ${rot1}`);
  verdad(await modo() === 'activo', 'Agios cambió de estado: ' + await modo());
  await captura('B5-ventanas-movidas');
  return { mouse: [a1.x - a0.x, a1.y - a0.y], dedo: [b1.x - b0.x, b1.y - b0.y], rot: rot1 - rot0 };
});

await paso('B6. Sugerencias recientes: las últimas 3 búsquedas', async () => {
  await buscar('salmo 87', { acumular: true });
  await buscar('conjunto 300', { acumular: true });
  const sug = await page.$$eval('#recientes button', bs => bs.map(b => b.textContent));
  verdad(sug.join('|') === 'conjunto 300|salmo 87|Lect. Gonz. 23', 'recientes: ' + sug.join('|'));
  const n = (await vivas()).length;
  verdad(n >= 6, 'debían acumularse ventanas: ' + n);
  const lista = await page.$$eval('#dLista span', s => s.map(x => x.textContent));
  verdad(n <= 8 || lista[lista.length - 1] === '+' + (n - 8), 'panel con «+N»: ' + lista);
  await captura('B6-muchas-ventanas');
  // Tocar una sugerencia busca
  await page.locator('#recientes button', { hasText: 'salmo 87' }).click();
  await esperarModo('activo', 30000);
  const ya = (await vivas()).filter(t => t.corta === 'S·87');
  verdad(ya.length === 1 && ya[0].destella, 'la sugerencia no buscó (o duplicó)');
  return { sug, abiertas: n, panel: lista };
});

await paso('B7. «Cerrar todas», apagar cierra todo y subir un archivo NO cierra las ventanas', async () => {
  const etapa = async (nombre, fn) => { try { return await fn(); } catch (e) { await captura('B7-fallo'); throw new Error(`${nombre} (modo ${await modo().catch(() => '?')}, recargas ${cargas}): ${e.message}`); } };
  const cargas0 = cargas;
  await etapa('cerrar todas', async () => {
    await page.click('#cerrarTodas');
    await esperarSinVentanas();
    verdad(await texto('#dAbiertas') === '0' && await texto('#dLista') === '—', 'panel tras cerrar todas');
  });
  await etapa('buscar 40', () => buscar('Lect. Gonz. 40'));
  await etapa('apagar con ventanas', async () => { await tocarAgios(); await esperarModo('apagado', 10000); await esperarSinVentanas(); });
  await etapa('encender', async () => { await tocarAgios(); await esperarModo('activo', 10000); });
  await etapa('buscar 41', () => buscar('Lect. Gonz. 41'));
  const n = (await vivas()).length;
  await etapa('subir', async () => {
    await subir('foto.jpg', Buffer.from('no es un docx'), 'image/jpeg');
    await esperarModo('error', 20000); await esperarModo('activo', 10000);
  });
  verdad((await vivas()).length === n, 'subir cerró ventanas');
  return { abiertasTrasSubir: n, recargasInesperadas: cargas - cargas0 };
});

/* ================================================================
   C. FLUJO COMPLETO (desde cero)
   ================================================================ */
await paso('C1. Pruebas unitarias (ordinales, analizador, referencias, búsqueda exacta)', async () => {
  const p2 = await ctx.newPage();
  await p2.goto(URL_APP + 'pruebas/index.html');
  await p2.waitForFunction(() => window.__pruebas, null, { timeout: 30000 });
  const r = await p2.evaluate(() => window.__pruebas);
  await p2.screenshot({ path: path.join(SALIDA, 'C1-pruebas-unitarias.png') });
  await p2.close();
  verdad(r.fallos.length === 0, JSON.stringify(r.fallos));
  return { total: r.total };
});

await paso('C2. Borrar la colección desde el menú (para procesar desde cero)', async () => {
  await cerrarVentanas();
  await page.click('#btnMenu');
  await page.waitForSelector('button[data-accion="borrar"]');
  await page.click('button[data-accion="borrar"]');
  await page.waitForFunction(() => !document.querySelector('button[data-accion="borrar"]'));
  const h = await huellaDatos();
  await page.click('#cerrarHoja');
  verdad(h.piezas === 0 && h.fragmentos === 0, JSON.stringify(h));
  verdad(await texto('#dConjuntos') === '—' && await texto('#dIndice') === 'sin documento' && await texto('#dDoc') === '—', 'paneles tras borrar');
  return h;
});

await paso('C3. Error: .docx sin estructura → luz roja y mensaje claro', async () => {
  await subir('sin-titulos.docx', docSin);
  await esperarModo('error', 30000);
  const d = await page.evaluate(() => window.__agios.destello);
  verdad(await page.locator('#chip.err').count(), 'el chip no se puso rojo');
  await page.waitForSelector('#hoja.abierta', { timeout: 5000 });
  const txt = await texto('#hojaContenido');
  await captura('C3-error-sin-estructura');
  verdad(d.color === '#ff4d5e', 'sin destello rojo');
  verdad(/No se reconoció ninguna Santa Lectura/.test(txt), txt.slice(0, 200));
  await page.click('#cerrarHoja');
  await esperarModo('activo');
});

let pctAntes = 0;
await paso('C4. Procesar (x3 + temblor, avance en el chip y en Índice)', async () => {
  await subir('FICTICIO-documento-de-prueba.docx', docV1);
  await esperarModo('procesando', 10000);
  const m = await page.evaluate(() => window.__agios.meta);
  verdad(m.mult === 3 && m.temblor === 1 && m.apertura === 0, 'coreografía de procesamiento ' + JSON.stringify(m));
  await page.waitForFunction(() => /procesando (\d+)% · \d+\/1107 piezas/.test(document.getElementById('estado').textContent) &&
    +document.getElementById('estado').textContent.match(/(\d+)%/)[1] >= 20, null, { timeout: 600000, polling: 100 });
  const e = await estado();
  pctAntes = +e.match(/(\d+)%/)[1];
  const ind = await texto('#dIndice');
  const alto = await page.evaluate(() => document.getElementById('chip').getBoundingClientRect().height);
  await captura('C4-procesando');
  verdad(/^indexando \d+%$/.test(ind), 'Índice: ' + ind);
  verdad(alto < 32, 'el chip se partió en dos líneas: ' + alto);
  return { estado: e, indice: ind };
});

await paso('C5. Interrupción (recargar a mitad) → continúa donde se quedó', async () => {
  await page.reload();
  await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
  await esperarModo('procesando', 15000);
  await page.waitForFunction(() => /procesando \d+%/.test(document.getElementById('estado').textContent), null, { timeout: 120000, polling: 50 });
  const pctDespues = +(await estado()).match(/(\d+)%/)[1];
  verdad(pctDespues >= pctAntes - 1, `empezó de cero: ${pctAntes}% → ${pctDespues}%`);
  await page.waitForFunction(() => ['exito', 'activo'].includes(window.__agios.modo), null, { timeout: 900000, polling: 100 });
  const d = await page.evaluate(() => window.__agios.destello);
  verdad(d.color === '#3ddc84', 'sin luz verde');
  await captura('C5-listo-luz-verde');
  await esperarModo('activo');
  verdad(await contarPend() === 0, 'quedaron fragmentos pendientes');
  const doc = await texto('#dDoc');
  verdad(await texto('#dIndice') === '● listo' && await texto('#dConjuntos') === '371' && /^(ahora|hace \d+ min)$/.test(doc), 'paneles tras procesar: ' + doc);
  return { pctAntes, pctDespues };
});

await paso('C6. Estructura detectada', async () => {
  await page.click('#btnMenu');
  await page.waitForSelector('#hoja.abierta');
  await page.click('button[data-accion="estructura"]');
  await page.waitForFunction(() => document.getElementById('hojaTitulo').textContent === 'Estructura detectada');
  const t = await texto('#hojaContenido');
  await captura('C6-estructura-detectada');
  for (const x of ['371Conjuntos', '371Santas Lecturas', '371Santos Salmos', '365Santos Evangelios', '89–94 (6)', 'Nota del copista', 'Conjunto 1', 'Conjunto 371'])
    verdad(t.includes(x), 'falta «' + x + '»');
  await page.click('#cerrarHoja');
});

await paso('C7. Referencias (x2 mientras busca)', async () => {
  const r = await buscar('Lect. Gonz. 145');
  verdad(r.mult === 2, 'no aceleró a x2: ' + r.mult);
  verdad(r.tarjetas[0].ref === 'Lect. Gonz. 145' && r.tarjetas.length >= 2 && r.tarjetas.length <= 5, JSON.stringify(r.tarjetas.map(t => t.ref)));
  const a = await buscar('octava lectura'); verdad(a.tarjetas[0].ref === 'Lect. Gonz. 8', a.tarjetas[0]?.ref);
  const b = await buscar('salmo 87'); verdad(b.tarjetas[0].ref === 'Salmo Gonz. 87', b.tarjetas[0]?.ref);
  const c = await buscar('Evang. Gonz. 16'); verdad(c.tarjetas[0].tipo === 'Santo Evangelio de Jesucristo', c.tarjetas[0]?.tipo);
  const d = await buscar('conjunto 300'); verdad(d.tarjetas.map(t => t.ref).join() === 'Lect. Gonz. 300,Salmo Gonz. 300,Evang. Gonz. 300', d.tarjetas.map(t => t.ref).join());
  const e = await buscar('Evang. Gonz. 90'); verdad(e.tarjetas.length === 0 && /No existe/.test(e.pista), e.pista);
  const s = await buscar('Salmo Gonz. 2'); verdad(s.tarjetas[0].tipo === 'Santo Salmo de Súplica', s.tarjetas[0]?.tipo);
  return { conjunto300: d.tarjetas.length, evang90: e.pista };
});

await paso('C8. Frase exacta sin acentos ni mayúsculas, con resaltado', async () => {
  const r = await buscar('LAMPARA DEL ALFARERO');
  await captura('C8-frase-exacta');
  verdad(r.tarjetas[0].ref === 'Evang. Gonz. 145', r.tarjetas[0]?.ref);
  verdad(r.tarjetas[0].marcado.includes('lámpara del alfarero'), JSON.stringify(r.tarjetas[0].marcado));
  verdad(/exacta/.test(r.tarjetas[0].origen), r.tarjetas[0].origen);
  verdad(r.tarjetas.length >= 2 && r.tarjetas.length <= 5, 'entre 2 y 5: ' + r.tarjetas.length);
  return { n: r.tarjetas.length };
});

const CONSULTAS = [
  ['mar', 'hombres que lanzan mallas desde un bote para capturar pescado'],
  ['pastor', 'el cuidador de corderos que va tras el animal extraviado'],
  ['sanacion', 'una persona postrada por la enfermedad recupera la salud'],
  ['casa', 'edificar una vivienda sobre piedra firme para resistir el temporal'],
  ['invierno', 'calentarse junto a las llamas cuando hiela'],
];
await paso('C9. Búsqueda por significado', async () => {
  const out = [];
  for (const [tema, q] of CONSULTAS) {
    const r = await buscar(q);
    if (tema === 'mar') await captura('C9-por-significado');
    verdad(r.tarjetas.length >= 2 && r.tarjetas.length <= 5, `${q}: ${r.tarjetas.length} resultados`);
    const temas = r.tarjetas.map(t => temaDeTexto(t.texto));
    verdad(temas[0] === tema, `«${q}» → tema ${temas[0]} (${r.tarjetas[0].ref})`);
    out.push({ tema, temas: temas.join(), primero: r.tarjetas[0].ref });
  }
  return out;
});

await paso('C10. Lector: Ver completo, anterior/siguiente, Lectura/Salmo/Evangelio, índice', async () => {
  await buscar('lampara del alfarero');
  await verCompleto(0);
  await page.waitForSelector('#lector.abierto');
  const titulo = () => texto('#lectorTitulo');
  verdad((await titulo()).startsWith('Evang. Gonz. 145'), await titulo());
  verdad(await page.locator('#lectorTexto mark').count() > 0, 'sin resaltado en el lector');
  await captura('C10-lector');
  await page.click('#lecAnterior'); verdad((await titulo()).startsWith('Evang. Gonz. 144'), await titulo());
  await page.click('#lecTipos button[data-tipo="lectura"]'); verdad((await titulo()).startsWith('Lect. Gonz. 144'), await titulo());
  await page.click('#lecTipos button[data-tipo="salmo"]'); verdad((await titulo()).startsWith('Salmo Gonz. 144'), await titulo());
  await page.click('#lecSiguiente'); verdad((await titulo()).startsWith('Salmo Gonz. 145'), await titulo());
  await page.click('#lecIndice');
  await page.waitForSelector('#hoja.abierta .rejilla');
  verdad(await page.locator('.rejilla button').count() === 371, 'índice incompleto');
  await page.click('.rejilla button:text-is("89")');
  verdad((await titulo()).startsWith('Lect. Gonz. 89'), await titulo());
  verdad(await page.locator('#lecTipos button[data-tipo="evangelio"]').isDisabled(), 'Evangelio 89 debía estar deshabilitado');
  await page.click('#lecIndice'); await page.fill('#irA', 'evangelio 88'); await page.press('#irA', 'Enter');
  await page.click('#lecSiguiente'); verdad((await titulo()).startsWith('Evang. Gonz. 95'), 'tras el 88 debía seguir el 95: ' + await titulo());
  await page.click('#cerrarLector');
});

await paso('C11. Actualización incremental (con ventanas abiertas, que no se cierran)', async () => {
  const abiertas = (await vivas()).length;
  await subir('FICTICIO-documento-de-prueba-v2.docx', docV2);
  await esperarModo('procesando', 10000);
  await page.waitForFunction(() => /de 5 pieza/.test(document.getElementById('hint').textContent), null, { timeout: 60000, polling: 50 });
  await page.waitForFunction(() => window.__agios.modo !== 'procesando', null, { timeout: 300000 });
  await page.waitForSelector('#hoja.abierta', { timeout: 5000 });
  const t = await texto('#hojaContenido');
  await captura('C11-actualizacion');
  verdad(/3 nuevas · 2 modificadas · 1106 sin cambios · 0 eliminadas/.test(t), t.slice(0, 400));
  await page.click('#cerrarHoja');
  await esperarModo('activo');
  verdad((await vivas()).length === abiertas, 'la subida cerró ventanas');
  verdad(await texto('#dConjuntos') === '372', 'panel Conjuntos: ' + await texto('#dConjuntos'));
  const r = await buscar('Esta frase fue agregada en la versión nueva');
  const refs = r.tarjetas.map(x => x.ref);
  verdad(refs.includes('Lect. Gonz. 12') && refs.includes('Evang. Gonz. 300'), JSON.stringify(refs));
  return { refs };
});

await paso('C12. Sin conexión: servidores apagados; app, tipografías, búsquedas y lector siguen', async () => {
  verdad(await page.evaluate(() => !!navigator.serviceWorker.controller), 'el service worker no controla la página');
  await srv.cerrar();
  const registroPrevio = srv.registro;
  await page.reload();
  await page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
  await encender();
  const fuentes = await page.evaluate(async () => { await document.fonts.ready; await document.fonts.load("600 20px 'Rajdhani'"); await document.fonts.load("500 11px 'JetBrains Mono'"); return [document.fonts.check("600 20px 'Rajdhani'"), document.fonts.check("500 11px 'JetBrains Mono'")]; });
  verdad(fuentes.every(Boolean), 'tipografías sin conexión: ' + fuentes);
  const a = await buscar('lampara del alfarero');
  verdad(a.tarjetas[0]?.ref === 'Evang. Gonz. 145', 'exacta sin conexión: ' + a.tarjetas[0]?.ref);
  const b = await buscar('hombres que lanzan mallas desde un bote para capturar pescado', { acumular: true });
  verdad(temaDeTexto(b.tarjetas[0]?.texto || '') === 'mar', 'significado sin conexión: ' + JSON.stringify(b.tarjetas[0]));
  await captura('C12-sin-conexion');
  srv = await iniciar({ raizApp: RAIZ, espejo: ESPEJO });
  srv.registro.unshift(...registroPrevio);
  return { exacta: a.tarjetas[0].ref, significado: b.tarjetas[0].ref, fuentes };
});

/* ================================================================
   D. CAPTURAS: CELULAR Y TABLETA (vertical y horizontal) + PROTOTIPO
   ================================================================ */
let peticionesAntesDelPrototipo = Infinity;
await paso('D1. Capturas en celular y tableta, junto al prototipo', async () => {
  const tamanos = [['celular', 390, 844], ['tableta-vertical', 820, 1180], ['tableta-horizontal', 1180, 820], ['celular-horizontal', 844, 390]];
  peticionesAntesDelPrototipo = peticiones.length;
  const proto = await ctx.newPage();
  await proto.goto(URL_APP + 'prototipo/anesthios/index.html');
  for (const [nombre, w, h] of tamanos) {
    await page.setViewportSize({ width: w, height: h });
    await cerrarVentanas();
    await buscar('Lect. Gonz. 23');
    await page.waitForTimeout(400);
    await captura('D-app-' + nombre);
    const v = await vivas();
    const zona = await page.locator('#zona').boundingBox();
    verdad(v.every(t => t.x >= 0 && t.y >= 0 && t.x + t.w <= zona.width + 1), `${nombre}: ventana fuera de la zona`);
    verdad(await page.evaluate(() => document.getElementById('chip').getBoundingClientRect().height) < 32, `${nombre}: chip partido`);
    await proto.setViewportSize({ width: w, height: h });
    await proto.waitForTimeout(300);
    await proto.screenshot({ path: path.join(SALIDA, 'D-prototipo-' + nombre + '.png') });
  }
  await proto.close();
  await page.setViewportSize({ width: 390, height: 844 });
});

await paso('D2. Privacidad: ninguna petición lleva texto del documento', async () => {
  const hosts = new Set(['localhost:8080', 'cdn.jsdelivr.net', 'huggingface.co', 'fonts.googleapis.com', 'fonts.gstatic.com']);
  const malas = peticiones.filter(p => {
    const u = new URL(p.url);
    if (u.protocol === 'blob:' || u.protocol === 'data:') return false;
    return p.metodo !== 'GET' || p.cuerpo || !hosts.has(u.host) || /alfarero|pescadores|Santa%20Lectura/i.test(p.url);
  });
  // La app usa sus tipografías locales: Google Fonts solo lo pide el prototipo.
  const deLaApp = peticiones.slice(0, peticionesAntesDelPrototipo).filter(p => /fonts\.(googleapis|gstatic)/.test(p.url));
  const servidor = srv.registro.filter(r => r.metodo !== 'GET' || r.bytesCuerpo > 0);
  verdad(!malas.length, JSON.stringify(malas.slice(0, 5)));
  verdad(!servidor.length, JSON.stringify(servidor.slice(0, 5)));
  verdad(!deLaApp.length, 'la app pidió Google Fonts: ' + deLaApp.map(p => p.url));
  return { peticionesNavegador: peticiones.length, googleFontsDeLaApp: deLaApp.length };
});

await paso('D3. Sin errores en la consola de la app', async () => {
  const reales = errores.filter(e => !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(e));
  verdad(!reales.length, JSON.stringify(reales.slice(0, 5)));
  return { ignorados: errores.length - reales.length };
});

await browser.close();
await srv.cerrar();
rmSync(DIR_ANTERIOR, { recursive: true, force: true });
writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 2));
console.log(`\n${informe.length - fallos}/${informe.length} pasos correctos. Capturas en ${SALIDA}`);
process.exit(fallos ? 1 : 0);
