/* ============================================================
   Prueba de extremo a extremo de Anesthios (Agios + Kyrien) con
   Playwright + Chromium. Solo para desarrollo.

   Uso:
     ESPEJO=/ruta/espejo SALIDA=/ruta/capturas JSZIP=/ruta/jszip.min.js \
       [VERSION_ANTERIOR=1db3790] node pruebas/e2e/e2e.mjs
   ESPEJO (opcional): espejo local de jsDelivr y Hugging Face hecho con
   preparar-espejo.sh; sin él se usa la red real.
   VERSION_ANTERIOR: commit publicado antes (Anesthios con solo Agios)
   para la prueba de actualización sin pérdida de datos.

   A. Actualización sin perder los datos de Agios (punto 0)
   B. Menú nebulosa: orbes, entrar, volver, ventanas restauradas,
      tercera colección ficticia como orbe, sin WebGL 2
   C. Kyrien: errores, procesamiento con el hechizo rearmándose al ritmo
      del avance, interrupción y reanudación, Estructura detectada,
      referencias, búsqueda exacta y por significado, ventanas que nacen
      del hechizo, enlaces a Agios y a Logos, lector e índice en árbol,
      inserciones en medio (solo 3 piezas), renombrada
   D. Transición: implosión, estallido y al azar; ajustes guardados;
      ventanas por asistente; la escena oculta no se dibuja
   E. Agios: ventanas (acumular, mover, no duplicar) siguen funcionando
   F. Sin conexión, privacidad, consola, capturas vs prototipos
   ============================================================ */
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciar } from './servidores.mjs';
import { generarDocumento, TEMAS } from '../generador.js';
import { generarDoctrina } from '../generador-doctrina.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const JSZip = require(process.env.JSZIP || 'jszip');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ESPEJO = process.env.ESPEJO || null;
const SALIDA = process.env.SALIDA || path.join(RAIZ, 'pruebas/e2e/salida');
const VERSION_ANTERIOR = process.env.VERSION_ANTERIOR || '1db3790';
mkdirSync(SALIDA, { recursive: true });
const URL_APP = 'http://localhost:8080/';

const informe = [];
let fallos = 0;
const paso = async (nombre, fn) => {
  const t0 = Date.now();
  try { const detalle = await fn(); informe.push({ nombre, ok: true, ms: Date.now() - t0, detalle }); console.log('✔', nombre, detalle ? JSON.stringify(detalle) : ''); }
  catch (e) { fallos++; informe.push({ nombre, ok: false, error: e.message }); console.log('✘', nombre, '\n   ', e.message.split('\n')[0]); await captura('FALLO-' + nombre.slice(0, 3).replace(/\W/g, '')).catch(() => {}); }
};
const verdad = (c, m) => { if (!c) throw new Error(m); };

// Documentos de prueba (texto inventado)
const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const lectV1 = Buffer.from(await generarDocumento(JSZip));
const docV1 = Buffer.from(await generarDoctrina(JSZip));
const docV2 = Buffer.from(await generarDoctrina(JSZip, { insertarCristologia: true, insertarCronica: true, modificarLogos: true }));
const docV3 = Buffer.from(await generarDoctrina(JSZip, { insertarCristologia: true, insertarCronica: true, modificarLogos: true, renombrarCronica: true }));

const DIR_ANTERIOR = mkdtempSync(path.join(os.tmpdir(), 'anesthios-anterior-'));
execSync(`git -C "${RAIZ}" archive ${VERSION_ANTERIOR} | tar -x -C "${DIR_ANTERIOR}"`);

let srv = await iniciar({ raizApp: DIR_ANTERIOR, espejo: ESPEJO });
const env = { ...process.env }; for (const k of Object.keys(env)) if (/proxy/i.test(k)) delete env[k];
const ARGS = ESPEJO ? ['--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1,MAP huggingface.co 127.0.0.1', '--ignore-certificate-errors', '--no-proxy-server'] : [];
const browser = await chromium.launch({ env, args: ARGS });
// Densidad 1: Chromium sin GPU dibuja por software; con 2 cada cuadro cuesta 4 veces más
// y las animaciones (que avanzan como máximo 50 ms por cuadro) se estiran en tiempo real.
const ctx = await browser.newContext({ ignoreHTTPSErrors: !!ESPEJO, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
let page = await ctx.newPage();
const peticiones = [];
ctx.on('request', r => peticiones.push({ url: r.url(), metodo: r.method(), cuerpo: r.postData() }));
const errores = [];
const vigilar = p => {
  p.on('pageerror', e => errores.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('dialog', d => d.accept());
};
vigilar(page);

const captura = (nombre, p = page) => p.screenshot({ path: path.join(SALIDA, nombre + '.png') });
const g = (expr) => page.evaluate(expr);
const modo = () => g(() => window.__agios.modo);
const estado = () => page.locator('#estado').textContent();
const texto = sel => page.locator(sel).textContent();
const esperarModo = (m, timeout = 60000) => page.waitForFunction(x => window.__agios?.modo === x, m, { timeout, polling: 50 });
const listo = () => page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
async function tocar() {
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
async function encender() { if (await modo() === 'apagado') await tocar(); await esperarModo('activo'); }
async function entrarA(col) {
  await page.click(`.orbe[data-col="${col}"]`);
  await page.waitForFunction(c => !window.__agios.viaje && window.__agios.activa === c && !window.__agios.enMenu, col, { timeout: 150000, polling: 100 });
}
async function cambiarA(col) {
  await page.click(`#selector button[data-col="${col}"]`);
  await page.waitForFunction(() => !!window.__agios.cambio, null, { timeout: 5000, polling: 20 });
  const c = await g(() => window.__agios.cambio);
  await page.waitForFunction(x => !window.__agios.cambio && window.__agios.activa === x, col, { timeout: 120000, polling: 100 });
  return c;
}
async function volverAlMenu() {
  await page.click('#aInicio');
  await page.waitForFunction(() => !window.__agios.viaje && window.__agios.enMenu, null, { timeout: 120000, polling: 100 });
}
async function subir(nombre, buffer, mimeType = MIME) {
  if (await page.locator('#hoja.abierta').count()) await page.click('#cerrarHoja');
  await esperarModo('activo');
  await page.click('#btnSubir');
  await page.waitForSelector('#subir.abierta');
  await page.setInputFiles('#archivo', { name: nombre, mimeType, buffer });
}
const VIS = '.resultados-col:not([hidden]) .tarjeta:not(.cerrando)';
const vivas = () => page.$$eval(VIS, ts => ts.map(t => ({
  pieza: t.dataset.pieza, corta: t.dataset.corta, ref: t.querySelector('.ref').textContent, tipo: t.querySelector('.tipo').textContent,
  texto: t.querySelector('p').textContent, marcado: [...t.querySelectorAll('mark')].map(m => m.textContent), enlaces: t.querySelectorAll('a.enlace').length,
  origen: t.querySelector('.origen')?.textContent || '', z: +t.style.zIndex, x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight,
  tema: t.classList.contains('t-kyrien') ? 'kyrien' : 'agios', visible: t.classList.contains('visible'), destella: t.classList.contains('destella'),
})));
async function cerrarVentanas() {
  const n = (await vivas()).length;
  if (n > 1) await page.click('#cerrarTodas');
  else if (n === 1) await page.$eval(VIS + ' .x', b => b.click());
  if (n) await page.waitForFunction(() => !document.querySelector('.resultados-col:not([hidden]) .tarjeta'), null, { timeout: 5000 });
}
const cerrarVentana = corta => page.$eval(`.resultados-col:not([hidden]) .tarjeta[data-corta="${corta}"]:not(.cerrando) .x`, b => b.click());
const verCompleto = (n = 0) => page.$$eval(VIS + ' .ver', (bs, i) => bs[i].click(), n);
async function buscar(q, { acumular = false } = {}) {
  await esperarModo('activo');
  if (!acumular) await cerrarVentanas();
  const antes = new Set((await vivas()).map(v => v.pieza));
  await page.fill('#consulta', q);
  await page.click('#btnBuscar');
  await page.waitForFunction(() => window.__agios.modo === 'buscando', null, { timeout: 5000, polling: 20 }).catch(() => {});
  const mult = await g(() => window.__agios.meta.mult);
  await esperarModo('activo', 120000);
  const tFin = Date.now();
  let tVisible = null;
  const hay = await page.locator(VIS).count();
  if (hay > antes.size) {
    await page.waitForFunction(n => document.querySelectorAll('.resultados-col:not([hidden]) .tarjeta.visible').length > n, antes.size, { timeout: 10000, polling: 20 });
    tVisible = Date.now() - tFin;
  }
  await page.waitForFunction(() => [...document.querySelectorAll('.resultados-col:not([hidden]) .tarjeta:not(.cerrando)')].every(t => t.classList.contains('visible')), null, { timeout: 15000 });
  const todas = await vivas();
  return { tarjetas: todas.filter(t => !antes.has(t.pieza)), todas, mult, tVisible, pista: await texto('#hint'), estado: await estado() };
}
const huella = col => page.evaluate(c => new Promise(ok => {
  const r = indexedDB.open('agios');
  r.onsuccess = () => {
    const db = r.result, tx = db.transaction(['colecciones', 'piezas', 'fragmentos']), out = { version: db.version, almacenes: [...db.objectStoreNames] };
    tx.objectStore('piezas').index('coleccion').count(c).onsuccess = e => { out.piezas = e.target.result; };
    tx.objectStore('fragmentos').index('coleccion').count(c).onsuccess = e => { out.fragmentos = e.target.result; };
    tx.objectStore('fragmentos').index('pend').count(c).onsuccess = e => { out.pendientes = e.target.result; };
    tx.objectStore('colecciones').get(c).onsuccess = e => { const x = e.target.result; out.actualizado = x?.actualizado; out.conjuntos = x?.informe?.datos?.conjuntos; out.bloques = x?.informe?.datos?.bloques; };
    tx.oncomplete = () => { db.close(); ok(out); };
  };
}), col);
const vectoresDe = (col) => page.evaluate(c => new Promise(ok => {
  const r = indexedDB.open('agios');
  r.onsuccess = () => {
    const q = r.result.transaction('fragmentos').objectStore('fragmentos').index('coleccion').getAll(c);
    q.onsuccess = () => { const m = {}; for (const f of q.result) m[f.id] = f.vector ? Array.from(f.vector.slice(0, 4)).join(',') : null; r.result.close(); ok(m); };
  };
}), col);
const temaDeTexto = t => Object.entries(TEMAS).find(([, frases]) => frases.some(f => t.includes(f.slice(0, 30))))?.[0];
async function ajuste(nombre, valor) {
  await page.click('#btnMenu'); await page.waitForSelector('#hoja.abierta .ajustes');
  await page.check(`.ajustes input[name="${nombre}"][value="${valor}"]`);
  await page.click('#cerrarHoja');
}

/* ================================================================
   A. ACTUALIZACIÓN SIN PERDER LOS DATOS DE AGIOS (punto 0)
   ================================================================ */
let huellaAntes = null, registroAlCambiar = 0;
await paso(`A1. Versión anterior (${VERSION_ANTERIOR}): procesar las Lecturas de prueba`, async () => {
  await page.goto(URL_APP); await listo();
  verdad(!(await page.$('#orbes')), 'debía ser la versión anterior (sin menú)');
  await tocar(); await esperarModo('activo');
  await subir('FICTICIO-documento-de-prueba.docx', lectV1);
  await esperarModo('procesando', 10000);
  await page.waitForFunction(() => window.__agios.modo !== 'procesando', null, { timeout: 900000, polling: 200 });
  await page.waitForFunction(() => window.__agios.modo === 'activo', null, { timeout: 10000 });
  if (await page.locator('#hoja.abierta').count()) await page.click('#cerrarHoja');
  await page.fill('#consulta', 'Lect. Gonz. 23'); await page.click('#btnBuscar');
  await page.waitForTimeout(2500);
  huellaAntes = await huella('lecturas');
  await captura('A1-version-anterior');
  verdad(huellaAntes.piezas === 1108 && huellaAntes.pendientes === 0 && huellaAntes.conjuntos === 371, JSON.stringify(huellaAntes));
  return huellaAntes;
});

await paso('A2. Se publica la versión nueva en el mismo origen: el service worker se actualiza solo', async () => {
  await page.reload(); await listo();
  verdad(await g(() => !!navigator.serviceWorker.controller), 'la versión anterior no tenía service worker activo');
  srv.cambiarRaiz(RAIZ);
  registroAlCambiar = srv.registro.length;
  const t0 = Date.now();
  await page.reload(); await listo();                 // el usuario abre la app: aún la anterior
  let forzada = false, recargoSola = false;
  for (let k = 0; ; k++) {
    if (await page.$('#orbes').catch(() => null)) { recargoSola = true; break; }
    const c = await page.evaluate(() => caches.keys()).catch(() => []);
    if (c.includes('agios-app-v4') && !c.includes('agios-app-v2') && k > 5) break;
    if (k === 90) { forzada = true; await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update())).catch(() => {}); }
    verdad(k < 240, 'la versión nueva no se activó: ' + c);
    await page.waitForTimeout(1000);
  }
  if (!recargoSola) { await page.reload(); }
  await listo();
  await page.waitForSelector('#orbes .orbe', { timeout: 30000 });
  const cachés = await page.evaluate(() => caches.keys());
  verdad(cachés.includes('agios-app-v4') && !cachés.some(k => /agios-app-v[123]$/.test(k)), 'cachés de la app: ' + cachés);
  verdad(cachés.includes('transformers-cache') && cachés.includes('agios-cdn-v1'), 'se perdió una caché que debía conservarse: ' + cachés);
  return { segundos: Math.round((Date.now() - t0) / 1000), recargoSola, comprobacion: forzada ? 'registration.update()' : 'automática', cachés };
});

await paso('A3. Sin subir nada: los datos de Agios siguen intactos y Agios funciona', async () => {
  const h = await huella('lecturas');
  verdad(JSON.stringify({ ...h, almacenes: undefined }) === JSON.stringify({ ...huellaAntes, almacenes: undefined }), `antes ${JSON.stringify(huellaAntes)} · después ${JSON.stringify(h)}`);
  verdad(h.version === 1, 'cambió la versión de IndexedDB: ' + h.version);
  verdad(await g(() => window.__agios.enMenu), 'debía abrir en el menú');
  await captura('A3a-menu-tras-actualizar');
  await entrarA('lecturas');
  await page.waitForTimeout(800);
  const panel = { conjuntos: await texto('#dConjuntos'), indice: await texto('#dIndice'), documento: await texto('#dDoc') };
  verdad(panel.conjuntos === '371' && panel.indice === '● listo' && /^(ahora|hace \d+ min|hoy \d)/.test(panel.documento), JSON.stringify(panel));
  verdad(!(await page.locator('#hoja.abierta').count()) && await modo() === 'activo', 'no debía reprocesar nada');
  await page.click('#btnMenu'); await page.waitForSelector('#hoja.abierta');
  await page.click('.doc[data-col="lecturas"] button[data-accion="estructura"]');
  const t = await texto('#hojaContenido');
  verdad(t.includes('371Conjuntos') && t.includes('89–94 (6)'), t.slice(0, 200));
  await page.click('#cerrarHoja');
  const a = await buscar('Lect. Gonz. 145');
  verdad(a.tarjetas[0]?.ref === 'Lect. Gonz. 145', 'exacta: ' + a.tarjetas[0]?.ref);
  const b = await buscar('hombres que lanzan mallas desde un bote para capturar pescado');
  verdad(temaDeTexto(b.tarjetas[0]?.texto || '') === 'mar' && /significado/.test(b.tarjetas[0].origen), 'significado: ' + JSON.stringify(b.tarjetas[0]));
  await verCompleto(0); await page.waitForSelector('#lector.abierto');
  const titulo = await texto('#lectorTitulo');
  await page.click('#cerrarLector');
  const modelo = srv.registro.slice(registroAlCambiar).filter(r => r.host === 'huggingface.co');
  verdad(!modelo.length, 'volvió a descargar el modelo: ' + modelo.map(r => r.ruta));
  await captura('A3b-agios-con-datos-anteriores');
  return { panel, exacta: a.tarjetas[0].ref, significado: b.tarjetas[0].ref, lector: titulo, descargasDelModelo: 0 };
});

/* ================================================================
   B. MENÚ, SELECTOR Y TRANSICIONES (con Agios)
   ================================================================ */
await paso('B1. Ventanas de Agios: acumular (23→24), mover sin girar, no duplicar', async () => {
  await cerrarVentanas();
  const a = await buscar('Lect. Gonz. 23');
  verdad(a.tarjetas.map(t => t.corta).join() === 'L·23,S·23,E·23', a.tarjetas.map(t => t.corta).join());
  verdad(a.tVisible < 1000, 'Agios no usa hechizo: las ventanas debían nacer de inmediato (' + a.tVisible + ' ms)');
  for (const c of ['S·23', 'E·23']) await cerrarVentana(c);
  await buscar('Lect. Gonz. 24', { acumular: true });
  for (const c of ['S·24', 'E·24']) await cerrarVentana(c);
  await page.waitForFunction(() => document.querySelectorAll('.resultados-col:not([hidden]) .tarjeta').length === 2);
  const lista = await page.$$eval('#dLista span', s => s.map(x => x.textContent));
  verdad(lista.join() === 'L·23,L·24', 'panel: ' + lista);
  await page.waitForTimeout(1200);
  const rot0 = (await g(() => window.__agios.S)).rot;
  const cab = await page.locator('.resultados-col:not([hidden]) .tarjeta[data-corta="L·24"] .cab .ref').boundingBox();
  await page.mouse.move(cab.x + 10, cab.y + cab.height / 2); await page.mouse.down();
  await page.mouse.move(cab.x + 50, cab.y + cab.height / 2 + 60, { steps: 8 }); await page.mouse.up();
  verdad(Math.abs((await g(() => window.__agios.S)).rot - rot0) < 1e-6 && await modo() === 'activo', 'arrastrar movió o apagó a Agios');
  const r = await buscar('Lect. Gonz. 23', { acumular: true });
  const l23 = (await vivas()).filter(t => t.corta === 'L·23');
  verdad(l23.length === 1 && l23[0].destella, 'L·23 se duplicó o no destelló');
  for (const c of ['S·23', 'E·23']) await cerrarVentana(c);
  await page.waitForFunction(() => document.querySelectorAll('.resultados-col:not([hidden]) .tarjeta').length === 2);
  await captura('B1-ventanas-agios');
  return { panel: lista, nuevasTrasRepetir: r.tarjetas.length };
});

await paso('B2. Selector AGIOS → KYRIEN: Implosión (~7 s), la escena oculta no se dibuja, ventanas guardadas', async () => {
  const d0 = await g(() => window.__agios.dibujos);
  await page.waitForTimeout(1000);
  const d1 = await g(() => window.__agios.dibujos);
  verdad(d1.doctrina === d0.doctrina, 'Kyrien (oculto) se dibujó');
  verdad(await g(() => window.__agios.nebulosa) === await g(() => window.__agios.nebulosa), '');
  const neb0 = await g(() => window.__agios.nebulosa);
  const t0 = Date.now();
  await page.click('#selector button[data-col="doctrina"]');
  await page.waitForFunction(() => !!window.__agios.cambio, null, { timeout: 5000, polling: 20 });
  const c = await g(() => window.__agios.cambio);
  const bloqueado = await page.evaluate(() => [...document.querySelectorAll('#selector button')].every(b => b.disabled) && document.getElementById('consulta').disabled && document.getElementById('btnSubir').disabled);
  await page.waitForTimeout(1300); await captura('B2a-implosion-fogonazo');
  await page.waitForTimeout(1500); await captura('B2b-implosion-galaxia');
  await page.waitForFunction(() => !window.__agios.cambio && window.__agios.activa === 'doctrina', null, { timeout: 120000, polling: 100 });
  const dur = Date.now() - t0;
  await page.waitForTimeout(700); await captura('B2c-kyrien');
  verdad(c.modo === 'implosion', 'estilo: ' + c.modo);
  verdad(bloqueado, 'durante la transición debían bloquearse selector, búsqueda y subir');
  // 7 s de animación; en un navegador sin GPU cada cuadro avanza como máximo 50 ms,
  // así que en tiempo real tarda más (en un dispositivo a 60 fps son ~7 s).
  verdad(c.dur === 7000 && dur >= 6000, 'duración ' + c.dur + ' / ' + dur);
  verdad(await g(() => window.__agios.tema) === 'tema-kyrien', 'tema');
  verdad((await vivas()).length === 0, 'se ven ventanas de Agios en Kyrien');
  const da = await g(() => window.__agios.dibujos); await page.waitForTimeout(1000); const db2 = await g(() => window.__agios.dibujos);
  verdad(db2.lecturas === da.lecturas && db2.doctrina > da.doctrina, 'debía dibujarse solo Kyrien: ' + JSON.stringify([da, db2]));
  verdad(await g(() => window.__agios.nebulosa) === neb0, 'la nebulosa se dibujó fuera del menú');
  const panel = { etiqueta: await texto('#dEtiquetaCol'), valor: await texto('#dConjuntos'), indice: await texto('#dIndice') };
  verdad(panel.etiqueta === 'Bloques' && panel.indice === 'sin documento', JSON.stringify(panel));
  return { animacion: c.dur, tiempoReal: dur, panel };
});

/* ================================================================
   C. KYRIEN
   ================================================================ */
await paso('C1. Kyrien: un .docx que no es la Doctrina → luz roja y mensaje claro', async () => {
  await subir('lecturas.docx', lectV1);
  await esperarModo('error', 60000);
  verdad(await page.locator('#chip.err').count(), 'sin luz roja');
  await page.waitForSelector('#hoja.abierta', { timeout: 5000 });
  const t = await texto('#hojaContenido');
  verdad(/No se reconoció ningún bloque de la Doctrina/.test(t), t.slice(0, 160));
  await captura('C1-kyrien-sin-estructura');
  await page.click('#cerrarHoja'); await esperarModo('activo');
});

let pctInterrupcion = 0;
await paso('C2. Kyrien procesa: el hechizo se deshace al tocar 📎 y se rearma al ritmo del avance', async () => {
  await page.click('#btnSubir'); await page.waitForSelector('#subir.abierta'); await page.waitForTimeout(1200);
  const abierto = (await g(() => window.__agios.S)).apertura;
  await captura('C2a-hechizo-deshecho');
  await page.setInputFiles('#archivo', { name: 'FICTICIO-doctrina-de-prueba.docx', mimeType: MIME, buffer: docV1 });
  await esperarModo('procesando', 10000);
  const muestras = [];
  for (let i = 0; i < 400 && muestras.length < 6; i++) {
    const s = await g(() => ({ p: window.__agios.progreso, a: window.__agios.S.apertura, e: document.getElementById('estado').textContent, m: window.__agios.meta }));
    if (!muestras.length || s.p - muestras[muestras.length - 1].p > 0.08) muestras.push(s);
    if (s.p > 0.35) break;
    await page.waitForTimeout(250);
  }
  await captura('C2b-rearmandose');
  pctInterrupcion = Math.round(100 * (await g(() => window.__agios.progreso)));
  verdad(abierto > 0.95, 'al tocar 📎 la apertura debía subir a 1: ' + abierto);
  verdad(muestras[0].m.mult === 3 && muestras[0].m.temblor === 1, 'x3 y temblor');
  for (const s of muestras) verdad(Math.abs(s.a - (1 - s.p)) < 0.12, `apertura ${s.a.toFixed(2)} ≠ 1 − progreso ${(1 - s.p).toFixed(2)}`);
  verdad(muestras.length >= 3 && muestras[muestras.length - 1].a < muestras[0].a, 'no se rearmó');
  return { abierto, muestras: muestras.map(s => [+s.p.toFixed(2), +s.a.toFixed(2)]), estado: muestras[muestras.length - 1].e };
});

await paso('C3. Interrupción a mitad (recargar) → menú → entrar a Kyrien → continúa donde se quedó', async () => {
  const pend = (await huella('doctrina')).pendientes;
  await page.reload(); await listo();
  verdad(await g(() => window.__agios.enMenu), 'debía abrir en el menú');
  await entrarA('doctrina');
  await esperarModo('procesando', 15000);
  await page.waitForFunction(() => /\d+%/.test(document.getElementById('estado').textContent), null, { timeout: 60000, polling: 50 });
  const e = await estado();
  const pct = +e.match(/(\d+)%/)[1];
  await page.waitForFunction(() => ['exito', 'activo'].includes(window.__agios.modo), null, { timeout: 900000, polling: 200 });
  verdad((await g(() => window.__agios.destello)).color === '#3ddc84', 'sin luz verde');
  await esperarModo('activo');
  const h = await huella('doctrina');
  verdad(h.pendientes === 0 && pend > 0 && pct > 0, `pendientes ${pend} → ${h.pendientes}; reanudó en ${pct}%`);
  return { pendientesAlInterrumpir: pend, reanudoEn: e, piezas: h.piezas, fragmentos: h.fragmentos };
});

await paso('C4. Estructura detectada de la Doctrina: 11 bloques, árbol plegable, dudosos', async () => {
  await page.click('#btnMenu'); await page.waitForSelector('#hoja.abierta');
  await page.click('.doc[data-col="doctrina"] button[data-accion="estructura"]');
  await page.waitForSelector('#hojaContenido .arbol');
  const t = await texto('#hojaContenido');
  for (const x of ['11Bloques', 'Títulos dudosos', 'ORACIÓN FINAL', 'CRÓNICAS', 'NOVENARIOS', 'PARTE II._'])
    verdad(t.includes(x), 'falta «' + x + '»');
  await page.locator('#hojaContenido .arbol > li.n-bloque').nth(5).locator('summary').first().click();
  await captura('C4-estructura-arbol');
  const plegados = await page.$$eval('#hojaContenido .arbol details', d => d.filter(x => !x.open).length);
  await page.click('#cerrarHoja');
  verdad(await texto('#dConjuntos') === '11', 'panel Bloques: ' + await texto('#dConjuntos'));
  return { plegados };
});

await paso('C5. Referencias en Kyrien: título, fecha de Logos, combinación, bloque', async () => {
  const a = await buscar('Te fallé');
  verdad(a.tarjetas[0]?.ref === 'Crónicas · “Te fallé”' && a.tarjetas[0].tipo === 'Crónicas' && a.tarjetas[0].corta === 'Crón·1', JSON.stringify(a.tarjetas[0]));
  verdad(a.tVisible >= 950, 'las ventanas debían nacer del hechizo (~1 s después): ' + a.tVisible + ' ms');
  verdad(a.tarjetas[0].tema === 'kyrien', 'ventana de pergamino');
  await captura('C5a-te-falle-hechizo');
  const b = await buscar('Logos 20 de septiembre de 2025');
  verdad(b.tarjetas[0]?.corta === 'Logos·20/09/25', JSON.stringify(b.tarjetas.map(t => t.corta)));
  const c = await buscar('7 de agosto 2017');
  verdad(c.tarjetas[0]?.corta === 'Logos·07/08/17', JSON.stringify(c.tarjetas.map(t => t.corta)));
  const d = await buscar('Estigmas fundamento biblico');
  verdad(d.tarjetas[0]?.ref === 'Estigmas · FUNDAMENTO BÍBLICO._', d.tarjetas[0]?.ref);
  const e = await buscar('El hijo de Dios');
  verdad(/EL HIJO DE DIOS/.test(e.tarjetas[0]?.ref || ''), e.tarjetas[0]?.ref);
  const f = await buscar('Crónicas');
  verdad(f.tarjetas.length === 5 && f.tarjetas.every(t => t.tipo === 'Crónicas') && /piezas/.test(f.pista), f.pista);
  const h = await buscar('Credo');
  verdad(h.tarjetas.length === 3 && h.tarjetas.some(t => /EL CREDO/.test(t.ref)), JSON.stringify(h.tarjetas.map(t => t.ref)));
  return { te_falle: a.tVisible + ' ms', crónicas: f.pista };
});

await paso('C6. Kyrien: búsqueda exacta y por significado', async () => {
  const a = await buscar('recorde entonces');
  verdad(a.tarjetas[0]?.ref === 'Crónicas · “Te fallé”' && a.tarjetas[0].marcado.some(m => /Recordé entonces/.test(m)), JSON.stringify(a.tarjetas[0]));
  const b = await buscar('hombres que lanzan mallas desde un bote para capturar pescado');
  verdad(temaDeTexto(b.tarjetas[0]?.texto || '') === 'mar' && b.tarjetas.length >= 2 && b.tarjetas.length <= 5, JSON.stringify(b.tarjetas.map(t => t.ref)));
  await captura('C6-kyrien-significado');
  return { exacta: a.tarjetas[0].ref, significado: b.tarjetas.map(t => t.corta) };
});

await paso('C7. Enlaces: «Lect. Gonz. 145» abre una ventana de Agios sobre Kyrien; «Palabra del Señor» abre Logos', async () => {
  await buscar('Te fallé');
  verdad((await vivas())[0].enlaces >= 1, 'la cita no es enlace');
  await page.$eval(VIS + ' a.enlace', a => a.click());
  await page.waitForFunction(() => [...document.querySelectorAll('.resultados-col:not([hidden]) .tarjeta.visible')].some(t => t.classList.contains('t-agios')), null, { timeout: 8000 });
  const v = await vivas();
  const ag = v.find(t => t.tema === 'agios');
  verdad(ag.ref === 'Lect. Gonz. 145' && ag.corta === 'L·145', JSON.stringify(ag));
  verdad(await g(() => window.__agios.activa) === 'doctrina' && await g(() => window.__agios.tema) === 'tema-kyrien', 'cambió de asistente');
  await captura('C7a-ventana-agios-en-kyrien');
  // Palabra del Señor → Logos (párrafo del Prólogo de Crónicas que la cita)
  await buscar('lo dice la palabra');
  const prol = (await vivas()).findIndex(t => t.corta === 'Crón·Pról');
  verdad(prol >= 0, 'falta el Prólogo de Crónicas: ' + (await vivas()).map(t => t.corta));
  const enlaces = await page.$$eval(VIS, (ts, i) => [...ts[i].querySelectorAll('a.enlace')].map(a => a.textContent), prol);
  verdad(enlaces.some(t => /Palabra del Señor, 20 de julio de 2024/.test(t)), 'Palabra del Señor no enlazada: ' + enlaces);
  verdad(!enlaces.some(t => /1 de enero de 2020/.test(t)), 'una fecha sin entrada no debía enlazarse');
  await page.$$eval(VIS, (ts, i) => [...ts[i].querySelectorAll('a.enlace')].find(a => /Palabra/.test(a.textContent)).click(), prol);
  await page.waitForFunction(() => [...document.querySelectorAll('.resultados-col:not([hidden]) .tarjeta')].some(t => t.dataset.corta === 'Logos·20/07/24'), null, { timeout: 8000 });
  return { agios: ag.ref, logos: 'Logos·20/07/24' };
});

await paso('C8. Lector de pergamino, enlace desde el lector e índice en árbol', async () => {
  await buscar('Te fallé');
  await verCompleto(0); await page.waitForSelector('#lector.abierto');
  verdad(await page.getAttribute('#lector', 'data-tema') === 'kyrien', 'el lector no es de pergamino');
  verdad((await texto('#lectorTitulo')).startsWith('Crónicas · “Te fallé”'), await texto('#lectorTitulo'));
  await captura('C8a-lector-pergamino');
  await page.click('#lecSiguiente');
  verdad((await texto('#lectorTitulo')).includes('El regreso a casa'), 'siguiente en orden del documento: ' + await texto('#lectorTitulo'));
  await page.click('#lecAnterior');
  await page.click('#lecIndice'); await page.waitForSelector('#hoja.abierta .arbol button.ir-pieza', { state: 'attached' });
  await captura('C8b-indice-arbol');
  await page.fill('#irA', 'Logos 7 de agosto de 2017'); await page.press('#irA', 'Enter');
  verdad((await texto('#lectorTitulo')).includes('7 de Agosto de 2017'), await texto('#lectorTitulo'));
  await page.click('#lecIndice');
  await page.$$eval('#hojaContenido .arbol button.ir-pieza', bs => bs.find(b => b.textContent === 'EL CREDO').click());
  verdad(await page.locator('#lectorTexto p').count() === 10, 'el Credo debía verse completo');
  await page.click('#cerrarLector');
  // enlace dentro del lector: cierra el lector y abre la ventana de Agios
  await buscar('Te fallé'); await verCompleto(0); await page.waitForSelector('#lector.abierto');
  await page.$eval('#lectorTexto a.enlace', a => a.click());
  await page.waitForFunction(() => !document.getElementById('lector').classList.contains('abierto'));
  await page.waitForFunction(() => [...document.querySelectorAll('.resultados-col:not([hidden]) .tarjeta')].some(t => t.dataset.corta === 'L·145'), null, { timeout: 8000 });
});

await paso('C9. Actualización con inserciones EN MEDIO: solo se reprocesan 3 piezas', async () => {
  const antes = await vectoresDe('doctrina');
  await subir('FICTICIO-doctrina-v2.docx', docV2);
  await esperarModo('procesando', 10000);
  const pista = await page.waitForFunction(() => { const t = document.getElementById('hint').textContent; return /pieza\(s\)/.test(t) && t; }, null, { timeout: 60000, polling: 20 }).then(h => h.jsonValue()).catch(() => '');
  await page.waitForFunction(() => window.__agios.modo !== 'procesando', null, { timeout: 300000 });
  await page.waitForSelector('#hoja.abierta', { timeout: 5000 });
  const t = await texto('#hojaContenido');
  await captura('C9-actualizacion-en-medio');
  verdad(/2 nuevas · 1 modificadas · \d+ sin cambios · 0 eliminadas/.test(t), t.slice(0, 400));
  await page.click('#cerrarHoja'); await esperarModo('activo');
  const despues = await vectoresDe('doctrina');
  const iguales = Object.keys(antes).filter(k => despues[k] && despues[k] === antes[k]).length;
  // Piezas cuyos fragmentos recibieron embeddings nuevos (o son nuevos): deben ser exactamente 3
  const pieza = k => k.slice(0, k.lastIndexOf('#'));
  const tocadas = [...new Set(Object.keys(despues).filter(k => despues[k] !== antes[k]).map(pieza))];
  verdad(tocadas.length === 3, 'piezas reprocesadas: ' + tocadas.join(' | '));
  const r = await buscar('farol del sacristan');
  verdad(r.tarjetas[0]?.ref === 'Crónicas · “La lámpara del sacristán”', r.tarjetas[0]?.ref);
  return { pista, reprocesadas: tocadas.map(k => k.split('|')[1]), fragmentosConservados: iguales, de: Object.keys(antes).length };
});

await paso('C10. Título cambiado con el mismo texto = renombrada (conserva su índice)', async () => {
  const antes = await vectoresDe('doctrina');
  await subir('FICTICIO-doctrina-v3.docx', docV3);
  await esperarModo('procesando', 10000);
  await page.waitForFunction(() => window.__agios.modo !== 'procesando', null, { timeout: 300000 });
  await page.waitForSelector('#hoja.abierta', { timeout: 5000 });
  const t = await texto('#hojaContenido');
  verdad(/0 nuevas · 0 modificadas · \d+ sin cambios · 0 eliminadas · 1 renombradas/.test(t), t.slice(0, 400));
  await page.click('#cerrarHoja'); await esperarModo('activo');
  const despues = await vectoresDe('doctrina');
  const nueva = Object.keys(despues).find(k => k.includes('la-oveja-que-regreso-al-redil'));
  const vieja = Object.keys(antes).find(k => k.includes('la-oveja-que-volvio'));
  verdad(nueva && vieja && despues[nueva] === antes[vieja] && !despues[vieja], 'el embedding no se conservó');
  const r = await buscar('La oveja que regresó al redil');
  verdad(/regresó al redil/.test(r.tarjetas[0]?.ref || ''), r.tarjetas[0]?.ref);
});

/* ================================================================
   D. TRANSICIONES Y AJUSTES
   ================================================================ */
let ventanasKyrien = '';
await paso('D1. Ajustes: Estallido → KYRIEN a AGIOS; las ventanas de Kyrien se guardan', async () => {
  await ajuste('anesthios.transicion', 'estallido');
  verdad(await g(() => localStorage.getItem('anesthios.transicion')) === 'estallido', 'no se guardó');
  ventanasKyrien = (await vivas()).map(t => t.corta).sort().join();
  verdad(ventanasKyrien.length > 0, 'debía haber ventanas abiertas en Kyrien');
  const c = await cambiarA('lecturas');
  verdad(c.modo === 'estallido' && c.dur === 6000, JSON.stringify(c));
  verdad((await vivas()).every(t => t.tema === 'agios') && !(await vivas()).some(t => t.tema === 'kyrien'), 'se ven ventanas de Kyrien en Agios');
  await buscar('Lect. Gonz. 23');
  await captura('D1-agios-tras-estallido');
  return { ventanasKyrien, agios: (await vivas()).map(t => t.corta) };
});
await paso('D2. Ajustes: Al azar; AGIOS → KYRIEN restaura sus ventanas; ajustes persistentes y con los colores del tema', async () => {
  await ajuste('anesthios.transicion', 'azar');
  const c = await cambiarA('doctrina');
  verdad(['implosion', 'estallido'].includes(c.modo), c.modo);
  const v = (await vivas()).map(t => t.corta).sort().join();
  verdad(v === ventanasKyrien, `ventanas de Kyrien: ${v} ≠ ${ventanasKyrien}`);
  const c2 = await cambiarA('lecturas');
  verdad((await vivas()).map(t => t.corta).sort().join() === 'E·23,L·23,S·23', 'ventanas de Agios no restauradas');
  await page.reload(); await listo();
  await entrarA('doctrina');
  await page.click('#btnMenu'); await page.waitForSelector('#hoja.abierta .ajustes');
  const marcado = await page.$eval('.ajustes input[name="anesthios.transicion"]:checked', i => i.value);
  const panelFondo = await page.$eval('#hoja .caja', e => getComputedStyle(e).backgroundColor);
  await captura('D2-ajustes-tema-kyrien');
  await page.click('#cerrarHoja');
  verdad(marcado === 'azar', 'ajuste no persistió: ' + marcado);
  verdad(panelFondo === 'rgb(58, 43, 29)', 'el panel de ajustes no toma el color de Kyrien: ' + panelFondo);
  await ajuste('anesthios.transicion', 'implosion');
  return { modos: [c.modo, c2.modo], panelFondo };
});

/* ================================================================
   E. MENÚ NEBULOSA
   ================================================================ */
await paso('E1. Volver al menú (tocar ANESTHIOS), entrar al otro asistente; las ventanas de cada uno se restauran', async () => {
  await buscar('Te fallé');
  const kyr = (await vivas()).map(t => t.corta).sort().join();
  const n0 = await g(() => window.__agios.nebulosa);
  await page.click('#aInicio');
  await page.waitForTimeout(1500); await captura('E1a-deshaciendose');
  await page.waitForFunction(() => !window.__agios.viaje && window.__agios.enMenu, null, { timeout: 120000, polling: 100 });
  verdad(await g(() => window.__agios.nebulosa) > n0, 'la nebulosa no se dibuja en el menú');
  verdad(await page.isVisible('#menu:not(.fuera)'), 'el menú no apareció');
  await captura('E1b-menu');
  // entrar a Agios: nacimiento estelar (caos → acreción → calma)
  await page.click('.orbe[data-col="lecturas"]');
  await page.waitForTimeout(2000); await captura('E1c-caos');
  await page.waitForTimeout(2600); await captura('E1d-acrecion');
  await page.waitForTimeout(2600); await captura('E1e-calma');
  await page.waitForFunction(() => !window.__agios.viaje && window.__agios.activa === 'lecturas', null, { timeout: 150000, polling: 100 });
  const n1 = await g(() => window.__agios.nebulosa); await page.waitForTimeout(800);
  verdad(await g(() => window.__agios.nebulosa) === n1, 'la nebulosa sigue dibujándose fuera del menú');
  await buscar('Lect. Gonz. 40');
  const ag = (await vivas()).map(t => t.corta).sort().join();
  await volverAlMenu(); await entrarA('doctrina');
  verdad((await vivas()).map(t => t.corta).sort().join() === kyr, 'ventanas de Kyrien no restauradas');
  await volverAlMenu(); await entrarA('lecturas');
  verdad((await vivas()).map(t => t.corta).sort().join() === ag, 'ventanas de Agios no restauradas');
  return { kyrien: kyr, agios: ag };
});

await paso('E2. Ajuste «Al abrir la app: entrar al último asistente usado»', async () => {
  await cambiarA('doctrina');                          // el último usado será Kyrien
  await ajuste('anesthios.inicio', 'ultimo');
  let s;
  try {
    await page.reload(); await listo();
    await page.waitForTimeout(800);
    s = await g(() => ({ enMenu: window.__agios.enMenu, activa: window.__agios.activa, tema: window.__agios.tema }));
  } finally {
    await ajuste('anesthios.inicio', 'menu');
  }
  verdad(!s.enMenu && s.activa === 'doctrina' && s.tema === 'tema-kyrien', JSON.stringify(s));
  await page.reload(); await listo();
  verdad(await g(() => window.__agios.enMenu), 'debía volver a abrir en el menú');
  return s;
});

await paso('E3. Una tercera colección ficticia en el registro aparece sola como orbe (sin tocar el menú)', async () => {
  const c2 = await browser.newContext({ ignoreHTTPSErrors: !!ESPEJO, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p2 = await c2.newPage(); vigilar(p2);
  await p2.route('**/js/colecciones.js', async r => {
    const res = await r.fetch(); let b = await res.text();
    b = b.replace("];\n\nexport const coleccion", "  { id: 'prueba3', asistente: 'Tercero', subtitulo: 'Colección ficticia', nombre: 'Prueba', escena: 'agios', analizador: 'lecturas', tema: 'agios' },\n];\n\nexport const coleccion");
    await r.fulfill({ response: res, body: b, headers: { ...res.headers(), 'content-type': 'text/javascript' } });
  });
  const salida = {};
  for (const [nombre, w, h] of [['vertical', 390, 844], ['horizontal', 844, 390], ['tableta', 1180, 820]]) {
    await p2.setViewportSize({ width: w, height: h });
    await p2.goto(URL_APP); await p2.waitForFunction(() => window.__agios); await p2.waitForTimeout(600);
    const cajas = await p2.$$eval('.orbe', os => os.map(o => { const r = o.querySelector('.bola').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
    const solapan = cajas.some((a, i) => cajas.some((b, j) => j > i && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]));
    const dentro = cajas.every(([l, t, r, b]) => l >= 0 && t >= 0 && r <= w && b <= h);
    await p2.screenshot({ path: path.join(SALIDA, `E3-tres-orbes-${nombre}.png`) });
    verdad(cajas.length === 3 && !solapan && dentro, `${nombre}: ${JSON.stringify(cajas)}`);
    salida[nombre] = cajas.length;
  }
  await c2.close();
  return salida;
});

await paso('E4. Sin WebGL 2: menú estático, entrar y cambiar con fundido', async () => {
  const b2 = await chromium.launch({ env, args: [...ARGS, '--disable-webgl2'] });
  const c2 = await b2.newContext({ ignoreHTTPSErrors: !!ESPEJO, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p2 = await c2.newPage();
  const err2 = []; p2.on('pageerror', e => err2.push(e.message));
  await p2.goto(URL_APP); await p2.waitForFunction(() => window.__agios);
  const w2 = await p2.evaluate(() => window.__agios.webgl2);
  await p2.screenshot({ path: path.join(SALIDA, 'E4a-sin-webgl-menu.png') });
  await p2.click('.orbe[data-col="doctrina"]');
  await p2.waitForFunction(() => !window.__agios.viaje && window.__agios.activa === 'doctrina', null, { timeout: 10000 });
  await p2.click('#selector button[data-col="lecturas"]');
  const m = await p2.waitForFunction(() => window.__agios.cambio?.modo, null, { timeout: 3000 }).then(h => h.jsonValue());
  await p2.waitForFunction(() => !window.__agios.cambio && window.__agios.activa === 'lecturas', null, { timeout: 10000 });
  await p2.screenshot({ path: path.join(SALIDA, 'E4b-sin-webgl-agios.png') });
  await b2.close();
  verdad(w2 === false && m === 'fundido' && !err2.length, JSON.stringify({ w2, m, err2 }));
  return { webgl2: w2, cambio: m };
});

/* ================================================================
   F. SIN CONEXIÓN, PRIVACIDAD, CONSOLA Y CAPTURAS
   ================================================================ */
await paso('F1. Sin conexión: menú, Kyrien (exacta y por significado), tipografías y transición', async () => {
  verdad(await g(() => !!navigator.serviceWorker.controller), 'el service worker no controla la página');
  await srv.cerrar();
  const previo = srv.registro;
  await page.reload(); await listo();
  await entrarA('doctrina');
  await encender();
  const fuentes = await page.evaluate(async () => { await document.fonts.load("600 20px 'Cinzel'"); await document.fonts.load("italic 500 15px 'Cormorant Garamond'"); await document.fonts.load("600 20px 'Rajdhani'");
    return [document.fonts.check("600 20px 'Cinzel'"), document.fonts.check("italic 500 15px 'Cormorant Garamond'"), document.fonts.check("600 20px 'Rajdhani'")]; });
  const a = await buscar('Te fallé');
  const b = await buscar('hombres que lanzan mallas desde un bote para capturar pescado');
  await captura('F1-sin-conexion-kyrien');
  const c = await cambiarA('lecturas');
  srv = await iniciar({ raizApp: RAIZ, espejo: ESPEJO }); srv.registro.unshift(...previo);
  verdad(fuentes.every(Boolean), 'tipografías sin conexión: ' + fuentes);
  verdad(a.tarjetas[0]?.ref === 'Crónicas · “Te fallé”' && temaDeTexto(b.tarjetas[0]?.texto || '') === 'mar', 'búsquedas sin conexión');
  return { fuentes, transicion: c.modo };
});

await paso('F2. Capturas en celular y tableta junto a los prototipos', async () => {
  const proto = await ctx.newPage();
  const pares = [['kyrien', 'prototipo/kyrien/index.html'], ['menu', 'prototipo/menu/index.html'], ['transicion', 'prototipo/transicion/index.html']];
  for (const [nombre, w, h] of [['celular', 390, 844], ['tableta-vertical', 820, 1180], ['tableta-horizontal', 1180, 820]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.reload(); await listo(); await page.waitForTimeout(1200);
    await captura(`F2-app-menu-${nombre}`);
    await entrarA('doctrina'); await encender(); await buscar('Te fallé'); await page.waitForTimeout(300);
    await captura(`F2-app-kyrien-${nombre}`);
    const v = await vivas(); const zona = await page.locator('#zona').boundingBox();
    verdad(v.every(t => t.x >= 0 && t.x + t.w <= zona.width + 1), `${nombre}: ventana fuera de la zona`);
    verdad(await page.evaluate(() => document.getElementById('chip').getBoundingClientRect().height) < 40, `${nombre}: chip partido`);
    for (const [pn, url] of pares) {
      await proto.setViewportSize({ width: w, height: h });
      await proto.goto(URL_APP + url); await proto.waitForTimeout(1500);
      await proto.screenshot({ path: path.join(SALIDA, `F2-prototipo-${pn}-${nombre}.png`) });
    }
  }
  await proto.close();
  await page.setViewportSize({ width: 390, height: 844 });
});

await paso('F3. Privacidad: ninguna petición lleva texto de los documentos', async () => {
  const hosts = new Set(['localhost:8080', 'cdn.jsdelivr.net', 'huggingface.co', 'fonts.googleapis.com', 'fonts.gstatic.com']);
  const malas = peticiones.filter(p => {
    const u = new URL(p.url);
    if (u.protocol === 'blob:' || u.protocol === 'data:') return false;
    return p.metodo !== 'GET' || p.cuerpo || !hosts.has(u.host) || /alfarero|pescadores|sacrist|Te%20fall/i.test(p.url);
  });
  const deLaApp = peticiones.filter(p => /fonts\.(googleapis|gstatic)/.test(p.url) && !/prototipo/.test(p.url));
  const servidor = srv.registro.filter(r => r.metodo !== 'GET' || r.bytesCuerpo > 0);
  verdad(!malas.length, JSON.stringify(malas.slice(0, 5)));
  verdad(!servidor.length, JSON.stringify(servidor.slice(0, 5)));
  return { peticionesNavegador: peticiones.length };
});
await paso('F4. Sin errores en la consola de la app', async () => {
  const reales = errores.filter(e => !/ERR_CONNECTION_REFUSED|Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e));
  verdad(!reales.length, JSON.stringify(reales.slice(0, 5)));
  return { ignorados: errores.length - reales.length };
});

await browser.close();
await srv.cerrar();
rmSync(DIR_ANTERIOR, { recursive: true, force: true });
writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 2));
console.log(`\n${informe.length - fallos}/${informe.length} pasos correctos. Capturas en ${SALIDA}`);
process.exit(fallos ? 1 : 0);
