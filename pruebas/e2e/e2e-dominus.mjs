/* ============================================================
   Prueba de extremo a extremo de Dominus nostrum (docs/DOMINUS.md,
   sección 10) con Playwright + Chromium. Solo para desarrollo.

   Uso:
     ESPEJO=/ruta/espejo SALIDA=/ruta/capturas JSZIP=/ruta/jszip \
       [VERSION_ANTERIOR=eee73a3] [BASE_ESCENAS=8a52363] node pruebas/e2e/e2e-dominus.mjs
   ESPEJO (opcional): espejo local de jsDelivr y Hugging Face hecho con
   preparar-espejo.sh; sin él se usa la red real. Si el espejo no trae el
   modelo, la búsqueda por significado queda pendiente (se usa la exacta).
   VERSION_ANTERIOR: la versión publicada en main antes de Dominus nostrum.
   BASE_ESCENAS: commit con las escenas de antes (para comparar con caos = 0).

    1. Actualización desde main sin perder datos, con Agios y Kyrien
    2. Comandos y variantes; «extender…» sin «/» no es comando
    3. Ciclo completo con «Demostración» (buscar primero, panel, 3 turnos
       sin panel, citas → lector, ventanas abiertas antes de activar,
       ventana nueva desde un enlace → el panel muestra solo esa)
    4. «Sin conectar»: el aviso y CERO peticiones de red
    5. Apagar por comando, tiempo (también con consulta en curso), tocar
       al asistente, cambiar AGIOS ⇄ KYRIEN y volver al menú: sin rastro
       en pantalla ni en localStorage, sessionStorage, IndexedDB o cachés
    6. /extender: 7 + 5 → suma 3; luego ya no; al reactivar se reinicia
    7. Encogido + cambio de alto (teclado) + minimizar: rayos centrados
    8. Rendimiento en perfil de celular de gama media vs el prototipo
    9. Con caos = 0 los dos modelos se ven exactamente como antes
   ============================================================ */
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciar } from './servidores.mjs';
import { generarDocumento } from '../generador.js';
import { generarDoctrina } from '../generador-doctrina.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const JSZip = require(process.env.JSZIP || 'jszip');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ESPEJO = process.env.ESPEJO || null;
const SALIDA = process.env.SALIDA || path.join(RAIZ, 'pruebas/e2e/salida/dominus');
const VERSION_ANTERIOR = process.env.VERSION_ANTERIOR || 'eee73a3';
const BASE_ESCENAS = process.env.BASE_ESCENAS || '8a52363';
const SOLO = process.env.SOLO ? new Set(process.env.SOLO.split(',')) : null;   // p. ej. SOLO=7,8,9
mkdirSync(SALIDA, { recursive: true });
const URL_APP = 'http://localhost:8080/';

const informe = [];
let fallos = 0;
const paso = async (nombre, fn) => {
  if (SOLO && !SOLO.has(nombre.split(/[.\s]/)[0])) return;
  const t0 = Date.now();
  try { const detalle = await fn(); informe.push({ nombre, ok: true, ms: Date.now() - t0, detalle }); console.log('✔', nombre, detalle ? JSON.stringify(detalle) : ''); }
  catch (e) { fallos++; informe.push({ nombre, ok: false, error: e.message }); console.log('✘', nombre, '\n   ', e.message.split('\n').slice(0, 3).join('\n    ')); await captura('FALLO-' + nombre.slice(0, 4).replace(/\W/g, '')).catch(() => {}); }
};
const verdad = (c, m) => { if (!c) throw new Error(m); };

// Documentos de prueba (texto inventado)
const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const lectV1 = Buffer.from(await generarDocumento(JSZip));
const docV1 = Buffer.from(await generarDoctrina(JSZip));

const DIR_ANTERIOR = mkdtempSync(path.join(os.tmpdir(), 'anesthios-main-'));
execSync(`git -C "${RAIZ}" archive ${VERSION_ANTERIOR} | tar -x -C "${DIR_ANTERIOR}"`);

let srv = await iniciar({ raizApp: SOLO && !SOLO.has('1') ? RAIZ : DIR_ANTERIOR, espejo: ESPEJO });
const env = { ...process.env }; for (const k of Object.keys(env)) if (/proxy/i.test(k)) delete env[k];
const ARGS = ESPEJO ? ['--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1,MAP huggingface.co 127.0.0.1', '--ignore-certificate-errors', '--no-proxy-server'] : [];
const browser = await chromium.launch({ env, args: ARGS });
const ctx = await browser.newContext({ ignoreHTTPSErrors: !!ESPEJO, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
/* Reloj de pared adelantable SOLO en la prueba (para «acortar» los 5 minutos sin tocar la app) */
await ctx.addInitScript(() => {
  let desfase = 0; const ahora = Date.now.bind(Date);
  Date.now = () => ahora() + desfase;
  Object.defineProperty(window, '__adelantar', { value: ms => { desfase += ms; } });
});
let page = await ctx.newPage();
const peticiones = [];
ctx.on('request', r => peticiones.push({ url: r.url(), metodo: r.method(), cuerpo: r.postData(), t: Date.now() }));
const errores = [];
const vigilar = p => {
  p.on('pageerror', e => errores.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('dialog', d => d.accept());
};
vigilar(page);

const captura = (nombre, p = page) => p.screenshot({ path: path.join(SALIDA, nombre + '.png') });
const g = expr => page.evaluate(expr);
const modo = () => g(() => window.__agios.modo);
const dm = () => g(() => window.__agios.dominus);
const texto = sel => page.locator(sel).textContent();
const esperarModo = (m, timeout = 60000) => page.waitForFunction(x => window.__agios?.modo === x, m, { timeout, polling: 50 });
const listo = () => page.waitForFunction(() => window.__agios, null, { timeout: 60000 });
const pausa = ms => page.waitForTimeout(ms);
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
  await page.waitForFunction(x => !window.__agios.cambio && window.__agios.activa === x, col, { timeout: 120000, polling: 100 });
}
async function volverAlMenu() {
  await page.click('#aInicio');
  await page.waitForFunction(() => !window.__agios.viaje && window.__agios.enMenu, null, { timeout: 120000, polling: 100 });
}
async function subir(nombre, buffer) {
  if (await page.locator('#hoja.abierta').count()) await page.click('#cerrarHoja');
  await esperarModo('activo');
  await page.click('#btnSubir');
  await page.waitForSelector('#subir.abierta');
  await page.setInputFiles('#archivo', { name: nombre, mimeType: MIME, buffer });
}
async function procesar(nombre, buffer) {
  await subir(nombre, buffer);
  await esperarModo('procesando', 10000);
  await page.waitForFunction(() => window.__agios.modo !== 'procesando', null, { timeout: 900000, polling: 200 });
  await esperarModo('activo', 20000);
  if (await page.locator('#hoja.abierta').count()) await page.click('#cerrarHoja');
}
/* Que el asistente esté libre (si se está reanudando el índice sin modelo, que termine) */
const libre = () => page.waitForFunction(() => window.__agios.modo === 'activo', null, { timeout: 120000, polling: 100 });
const VIS = '.resultados-col:not([hidden]) .tarjeta:not(.cerrando):not(.dm-chat)';
const vivas = () => page.$$eval(VIS, ts => ts.map(t => ({
  pieza: t.dataset.pieza, corta: t.dataset.corta, ref: t.querySelector('.ref').textContent, num: t.querySelector('.dm-num')?.textContent || null,
  tema: t.classList.contains('t-kyrien') ? 'kyrien' : 'agios', visible: t.classList.contains('visible'),
  enlaces: t.querySelectorAll('a.enlace').length,
})));
async function cerrarVentanas() {
  const n = (await vivas()).length;
  if (n) await page.evaluate(() => document.getElementById('cerrarTodas').click());
  await page.waitForFunction(() => !document.querySelector('.resultados-col:not([hidden]) .tarjeta'), null, { timeout: 5000 });
}
async function buscar(q, { acumular = false } = {}) {
  await libre();
  if (!acumular) await cerrarVentanas();
  await page.fill('#consulta', q);
  await page.click('#btnBuscar');
  await page.waitForFunction(() => window.__agios.modo === 'buscando', null, { timeout: 5000, polling: 20 }).catch(() => {});
  await esperarModo('activo', 120000);
  await page.waitForFunction(() => [...document.querySelectorAll('.resultados-col:not([hidden]) .tarjeta:not(.cerrando)')].every(t => t.classList.contains('visible')), null, { timeout: 15000 });
  return vivas();
}
/* Escribir en la consola y enviar (como el usuario) */
async function enviar(q) {
  await page.waitForFunction(() => !document.getElementById('consulta').disabled, null, { timeout: 120000, polling: 50 });
  await page.fill('#consulta', q);
  await page.press('#consulta', 'Enter');
}
const huella = col => page.evaluate(c => new Promise(ok => {
  const r = indexedDB.open('agios');
  r.onsuccess = () => {
    const db = r.result, tx = db.transaction(['colecciones', 'piezas', 'fragmentos']), out = { version: db.version, almacenes: [...db.objectStoreNames].join() };
    tx.objectStore('piezas').index('coleccion').count(c).onsuccess = e => { out.piezas = e.target.result; };
    tx.objectStore('fragmentos').index('coleccion').count(c).onsuccess = e => { out.fragmentos = e.target.result; };
    tx.objectStore('fragmentos').index('pend').count(c).onsuccess = e => { out.pendientes = e.target.result; };
    tx.objectStore('colecciones').get(c).onsuccess = e => { const x = e.target.result; out.actualizado = x?.actualizado; out.documento = x?.documento?.nombre; out.conjuntos = x?.informe?.datos?.conjuntos; out.bloques = x?.informe?.datos?.bloques; };
    tx.oncomplete = () => { db.close(); ok(out); };
  };
}), col);
async function ajuste(nombre, valor) {
  await libre();
  await page.click('#btnMenu'); await page.waitForSelector('#hoja.abierta .ajustes');
  await page.check(`.ajustes input[name="${nombre}"][value="${valor}"]`);
  await page.click('#cerrarHoja');
}
const panelVisible = () => g(() => document.querySelector('.dm-panel')?.classList.contains('ver'));
const esperarPanel = () => page.waitForSelector('.dm-panel.ver', { timeout: 30000 });
const esperarRespuesta = n => page.waitForFunction(k => window.__agios.dominus.mensajes >= k && !window.__agios.dominus.consultando && window.__agios.modo === 'activo', n, { timeout: 30000, polling: 50 });
const mensajesVisibles = () => page.$$eval('.dm-chat .dm-msg', ms => ms.map(m => ({ clase: m.className.replace('dm-msg ', ''), texto: m.textContent, citas: [...m.querySelectorAll('.dm-cita')].map(b => b.dataset.n) })));

/* Rastro de Dominus nostrum en pantalla y en el almacenamiento */
async function sinRastro(tokens) {
  await pausa(450);                              // la ventana de conversación se cierra con su animación
  const r = await page.evaluate(async tokens => {
    const pantalla = {
      chat: document.querySelectorAll('.dm-chat').length, numeros: document.querySelectorAll('.dm-num').length,
      panel: document.querySelector('.dm-panel.ver') ? 1 : 0, panelHtml: document.querySelector('.dm-panel')?.innerHTML.length || 0,
      replegado: document.querySelectorAll('.dm-replegado').length, lectorLibre: document.getElementById('lector').classList.contains('libre') ? 1 : 0,
      chipDm: document.getElementById('chip').classList.contains('dm') ? 1 : 0,
      lectorConTexto: tokens.some(t => document.getElementById('lector').textContent.includes(t)) ? 1 : 0,
      paginaConTexto: tokens.filter(t => document.body.innerText.includes(t)),
    };
    const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
    const ss = sessionStorage.length;
    const bases = (await indexedDB.databases()).map(d => d.name);
    const enIdb = await new Promise(ok => {
      const q = indexedDB.open('agios');
      q.onsuccess = () => {
        const db = q.result, nombres = [...db.objectStoreNames], tx = db.transaction(nombres), hallados = [];
        for (const n of nombres) tx.objectStore(n).openCursor().onsuccess = e => {
          const c = e.target.result; if (!c) return;
          const v = JSON.stringify(c.value, (k, x) => (x instanceof ArrayBuffer || ArrayBuffer.isView(x) ? undefined : x));
          for (const t of tokens) if (v.includes(t)) hallados.push(n + ':' + t);
          if (/dominus/i.test(String(c.key))) hallados.push(n + ':' + c.key);
          c.continue();
        };
        tx.oncomplete = () => { db.close(); ok(hallados); };
      };
    });
    const caches_ = [];
    for (const k of await caches.keys()) {
      if (/dominus/i.test(k)) caches_.push(k);
      for (const req of await (await caches.open(k)).keys()) if (tokens.some(t => decodeURIComponent(req.url).includes(t)) || /dominus\/(?!modo|conversacion|efectos|instruccion|cerebros)/.test(req.url)) caches_.push(req.url);
    }
    return { pantalla, ls, ss, bases, enIdb, caches: caches_, estado: window.__agios.dominus };
  }, tokens);
  const p = r.pantalla;
  verdad(!p.chat && !p.numeros && !p.panel && !p.panelHtml && !p.replegado && !p.lectorLibre && !p.chipDm && !p.lectorConTexto && !p.paginaConTexto.length, 'en pantalla: ' + JSON.stringify(p));
  verdad(!r.estado.encendido && !r.estado.fragmentos && !r.estado.mensajes && !r.estado.ventana && !r.estado.panel && !r.estado.consultando, 'en memoria: ' + JSON.stringify(r.estado));
  const clavesDm = Object.keys(r.ls).filter(k => /dominus/i.test(k));
  verdad(clavesDm.every(k => k === 'anesthios.dominus.cerebro'), 'localStorage: ' + clavesDm);
  verdad(!Object.values(r.ls).some(v => tokens.some(t => String(v).includes(t))), 'localStorage con texto de la conversación: ' + JSON.stringify(r.ls));
  verdad(r.ss === 0, 'sessionStorage: ' + r.ss);
  verdad(r.bases.every(b => b === 'agios'), 'bases IndexedDB: ' + r.bases);
  verdad(!r.enIdb.length, 'IndexedDB: ' + r.enIdb);
  verdad(!r.caches.length, 'cachés: ' + r.caches);
  return { localStorage: Object.keys(r.ls).sort(), sessionStorage: r.ss, indexedDB: r.bases };
}

/* ================================================================
   1. ACTUALIZACIÓN DESDE main SIN PERDER DATOS (Agios y Kyrien)
   ================================================================ */
let huellas = {};
await paso(`1a. main (${VERSION_ANTERIOR}): procesar las Lecturas (Agios) y la Doctrina (Kyrien) de prueba`, async () => {
  await page.goto(URL_APP); await listo();
  verdad(!(await page.$('#sugDominus')), 'debía ser la versión de main (sin Dominus nostrum)');
  await entrarA('lecturas');
  await procesar('FICTICIO-documento-de-prueba.docx', lectV1);
  await cambiarA('doctrina');
  await procesar('FICTICIO-doctrina-de-prueba.docx', docV1);
  huellas = { lecturas: await huella('lecturas'), doctrina: await huella('doctrina') };
  await captura('1a-main-con-datos');
  verdad(huellas.lecturas.piezas === 1108 && huellas.lecturas.conjuntos === 371, JSON.stringify(huellas.lecturas));
  verdad(huellas.doctrina.bloques === 11 && huellas.doctrina.piezas > 0, JSON.stringify(huellas.doctrina));
  return huellas;
});

await paso('1b. Se publica la versión nueva: el service worker se actualiza solo; Agios y Kyrien funcionan sin subir nada', async () => {
  await volverAlMenu();
  verdad(await g(() => !!navigator.serviceWorker.controller), 'main no tenía service worker activo');
  srv.cambiarRaiz(RAIZ);
  const marca = srv.registro.length;
  await page.reload(); await listo();
  let recargoSola = false;
  for (let k = 0; ; k++) {
    if (await page.$('#sugDominus').catch(() => null)) { recargoSola = true; break; }
    const c = await page.evaluate(() => caches.keys()).catch(() => []);
    if (c.includes('agios-app-v4') && !c.includes('agios-app-v3') && k > 5) break;
    if (k === 90) await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update())).catch(() => {});
    verdad(k < 240, 'la versión nueva no se activó: ' + c);
    await pausa(1000);
  }
  if (!recargoSola) await page.reload();
  await listo(); await page.waitForSelector('#sugDominus', { state: 'attached', timeout: 30000 });
  const cachés = await page.evaluate(() => caches.keys());
  verdad(cachés.includes('agios-app-v4') && !cachés.some(k => /agios-app-v[123]$/.test(k)) && cachés.includes('agios-cdn-v1'), 'cachés: ' + cachés);
  const despues = { lecturas: await huella('lecturas'), doctrina: await huella('doctrina') };
  verdad(JSON.stringify(despues) === JSON.stringify(huellas), `antes ${JSON.stringify(huellas)} · después ${JSON.stringify(despues)}`);
  // Agios
  await entrarA('lecturas'); await libre();
  const panelA = { conjuntos: await texto('#dConjuntos'), documento: await texto('#dDoc') };
  verdad(panelA.conjuntos === '371' && panelA.documento !== '—', JSON.stringify(panelA));
  const a = await buscar('Lect. Gonz. 145');
  verdad(a[0]?.ref === 'Lect. Gonz. 145', 'Agios, búsqueda: ' + JSON.stringify(a.map(x => x.ref)));
  await page.$$eval(VIS + ' .ver', bs => bs[0].click()); await page.waitForSelector('#lector.abierto');
  const lectorA = await texto('#lectorTitulo'); await page.click('#cerrarLector');
  // Kyrien
  await cambiarA('doctrina'); await libre();
  const k = await buscar('Te fallé');
  verdad(k[0]?.ref === 'Crónicas · “Te fallé”', 'Kyrien, búsqueda: ' + JSON.stringify(k.map(x => x.ref)));
  verdad(await texto('#dConjuntos') === '11', 'Kyrien, bloques');
  const final = { lecturas: await huella('lecturas'), doctrina: await huella('doctrina') };
  verdad(JSON.stringify(final) === JSON.stringify(huellas), 'los datos cambiaron al usar la app: ' + JSON.stringify(final));
  const subidas = srv.registro.slice(marca).filter(r => r.metodo !== 'GET' || r.bytesCuerpo > 0);
  verdad(!subidas.length, 'se envió algo: ' + JSON.stringify(subidas));
  await captura('1b-kyrien-tras-actualizar');
  await cerrarVentanas();
  return { cachés, recargoSola, agios: { panel: panelA, busqueda: a[0].ref, lector: lectorA }, kyrien: k[0].ref, datos: 'idénticos' };
});

if (SOLO && !SOLO.has('1')) {
  // Sin la prueba 1 hacen falta datos: se procesan con la versión nueva
  await page.goto(URL_APP); await listo();
  await entrarA('lecturas'); await procesar('FICTICIO-documento-de-prueba.docx', lectV1);
  await cambiarA('doctrina'); await procesar('FICTICIO-doctrina-de-prueba.docx', docV1);
  await cambiarA('lecturas');
}

/* ================================================================
   2. COMANDOS Y VARIANTES
   ================================================================ */
await paso('2a. Expresiones: variantes del comando y de /extender (sin acentos, mayúsculas, sin «/»)', async () => {
  const r = await page.evaluate(async () => {
    const m = await import('./js/dominus/modo.js');
    const comandos = ['/Dominus nostrum', '/ Domínus nostrum', 'Dominus noster', '/dominus nostro', 'DOMINUS NOSTRUM', '  /Dominus Nostrum  '];
    const noComandos = ['dominus', 'el dominus nostrum dice', 'extender', 'Dominio nuestro'];
    const ext = ['/extender(5)', '/Extender( 5 )', '/extender 5', '/extender(5 min)', '/éxtender(5)'];
    const noExt = ['extender(5)', 'extender la misericordia', 'extender 5', '/extenderse(5)'];
    const num = s => { const x = m.sinAcentos(s).match(m.RE_EXTENDER); return x ? parseInt(x[1].replace(/[^\d]/g, ''), 10) : null; };
    return {
      comandos: comandos.map(m.esComando), noComandos: noComandos.map(m.esComando),
      ext: ext.map(m.esExtender), minutos: ext.map(num), noExt: noExt.map(m.esExtender),
    };
  });
  verdad(r.comandos.every(Boolean), 'comandos: ' + r.comandos);
  verdad(!r.noComandos.some(Boolean), 'no comandos: ' + r.noComandos);
  verdad(r.ext.every(Boolean) && r.minutos.every(n => n === 5), 'extender: ' + r.ext + ' / ' + r.minutos);
  verdad(!r.noExt.some(Boolean), '«extender…» sin «/» no es comando: ' + r.noExt);
  return r;
});

await paso('2b. En la consola: con el asistente apagado solo avisa; variantes encienden y apagan; «extender…» es una pregunta', async () => {
  if (await g(() => window.__agios.activa) !== 'lecturas') await cambiarA('lecturas');
  await libre();
  if (!(await page.locator('#sugDominus').count())) throw new Error('falta el atajo ✦');
  // apagado: el campo está deshabilitado, pero el formulario se puede enviar por código
  await tocar(); await esperarModo('apagado');
  await page.evaluate(() => { document.getElementById('consulta').value = '/Dominus nostrum'; document.getElementById('form').requestSubmit(); });
  await pausa(150);
  const avisoApagado = await texto('#hint');
  verdad(/^Primero toca a Agios para encenderlo$/.test(avisoApagado) && !(await dm()).encendido, 'apagado: ' + avisoApagado);
  await tocar(); await esperarModo('activo');
  const pasos = [];
  for (const q of ['/ Domínus nostrum', 'Dominus noster', '/dominus nostro', 'DOMINUS NOSTRUM']) {
    await enviar(q); await pausa(200);
    pasos.push([q, (await dm()).encendido, await texto('#hint')]);
  }
  verdad(pasos.map(p => p[1]).join() === 'true,false,true,false', JSON.stringify(pasos));
  verdad(/^Dominus nostrum activado · 5 min/.test(pasos[0][2]) && /^Dominus nostrum desactivado · conversación borrada$/.test(pasos[1][2]), JSON.stringify(pasos));
  // el atajo ✦ hace lo mismo que el comando
  await page.click('#sugDominus'); await pausa(200);
  verdad((await dm()).encendido, 'el atajo ✦ no encendió');
  const chip = await texto('#chip');
  verdad(/^Dominus nostrum ·\d:\d\d$/.test(chip.replace(/\s+/g, ' ').replace('· ', '·')), 'chip: ' + chip);
  verdad(await page.getAttribute('#consulta', 'placeholder') === 'Pregúntale a Dominus nostrum sobre lo encontrado…', 'placeholder');
  // una pregunta que empieza con «extender» no es comando: se busca primero (no cambia el tiempo)
  await cerrarVentanas();
  const ext0 = (await dm()).extendido;
  await enviar('extender las redes de los pescadores en la barca');
  await page.waitForFunction(() => window.__agios.modo === 'buscando' || document.querySelector('.dm-panel.ver'), null, { timeout: 10000, polling: 20 });
  await esperarPanel();
  verdad((await dm()).extendido === ext0, '«extender…» cambió la extensión');
  await page.click('.dm-panel .dm-cancelar');
  await page.click('#sugDominus'); await pausa(200);
  verdad(!(await dm()).encendido, 'el atajo ✦ no apagó');
  return { avisoApagado, pasos: pasos.map(p => p.slice(0, 2)), chip };
});

/* ================================================================
   3. CICLO COMPLETO CON «DEMOSTRACIÓN»
   ================================================================ */
const TOKENS = [];
await paso('3a. Demostración: activar → preguntar sin ventanas (busca primero) → panel → consulta → respuesta con citas', async () => {
  await ajuste('anesthios.dominus.cerebro', 'demostracion');
  await cerrarVentanas();
  await enviar('/Dominus nostrum'); await pausa(300);
  const q1 = '¿Qué hacen los pescadores con las redes en la barca? zafiro1';   // sin el modelo, la búsqueda es solo exacta
  TOKENS.push('zafiro1');
  await enviar(q1);
  await page.waitForFunction(() => window.__agios.modo === 'buscando', null, { timeout: 5000, polling: 20 });
  await esperarPanel();
  const ventanas = await vivas();
  const panel = await page.evaluate(() => ({
    pregunta: document.querySelector('.dm-panel .dm-preg').textContent, frags: [...document.querySelectorAll('.dm-panel .dm-frag')].map(l => l.querySelector('b').textContent),
    nums: [...document.querySelectorAll('.dm-panel .dm-n')].map(n => n.textContent), nota: document.querySelector('.dm-panel .dm-nota').textContent,
    estado: document.getElementById('estado').textContent,
  }));
  await captura('3a-panel-agios');
  verdad(ventanas.length >= 2 && panel.frags.length === ventanas.length, `ventanas ${ventanas.length} / panel ${panel.frags.length}`);
  verdad(panel.pregunta.includes(q1), panel.pregunta);
  verdad(ventanas.map(v => v.num).join() === panel.nums.join() && panel.nums.join() === panel.nums.map((_, i) => i + 1).join(), 'números [n]: ' + JSON.stringify([ventanas.map(v => v.num), panel.nums]));
  verdad(/El documento completo no sale/.test(panel.nota) && /solo con lo que digan los fragmentos/.test(panel.nota) && /Cerebro: demostración \(simulado\) — no se envía nada/.test(panel.nota) && /≈ \d+ palabras/.test(panel.nota), panel.nota);
  verdad(panel.estado === 'Dominus nostrum · preparando', panel.estado);
  // la pregunta NO se guardó como búsqueda reciente
  verdad(!(await g(() => Object.values(localStorage).join('|'))).includes('zafiro1'), 'la pregunta quedó en localStorage');
  await page.click('.dm-panel .dm-consultar');
  await page.waitForFunction(() => window.__agios.dominus.consultando, null, { timeout: 5000, polling: 20 });
  await pausa(900);
  const durante = await page.evaluate(() => ({ estado: document.getElementById('estado').textContent, d: window.__agios.dominus, caos: window.__agios.caos, mult: window.__agios.meta.mult,
    replegadas: [...document.querySelectorAll('.resultados-col:not([hidden]).dm-replegado .tarjeta:not(.dm-chat)')].every(t => getComputedStyle(t).pointerEvents === 'none'),
    escribiendo: !!document.querySelector('.dm-chat .dm-pensando') }));
  await captura('3a-consultando');
  verdad(durante.estado === 'Dominus nostrum · consultando afuera' && durante.escribiendo && durante.replegadas, JSON.stringify(durante));
  verdad(durante.d.intensidad > 0.75 && durante.caos > 0.9 && durante.mult === 3 && durante.d.fase === 'pensando', JSON.stringify(durante));
  await esperarRespuesta(2);
  const msgs = await mensajesVisibles();
  const chip = (await texto('#chip')).replace(/\s+/g, ' ');
  verdad(msgs.length === 2 && msgs[0].clase === 'yo' && msgs[1].clase === 'dom' && msgs[1].citas.length >= 2, JSON.stringify(msgs));
  verdad(msgs[1].citas.every(n => +n >= 1 && +n <= ventanas.length), 'citas inválidas: ' + msgs[1].citas);
  verdad(/^Dominus nostrum ·\s?\d:\d\d$/.test(chip.trim()), 'el chip debía volver a la cuenta regresiva: ' + chip);
  await captura('3a-respuesta');
  return { ventanas: ventanas.map(v => v.corta), panel: panel.nums, citas: msgs[1].citas, durante: { caos: +durante.caos.toFixed(2), I: +durante.d.intensidad.toFixed(2), mult: durante.mult } };
});

await paso('3b. Conversación de 3 turnos sin panel; las citas abren el lector; «Qué se ha enviado»', async () => {
  let panelVisto = false;
  const vigia = setInterval(async () => { if (await panelVisible().catch(() => false)) panelVisto = true; }, 100);
  for (const [i, q] of [[4, 'y que pasa despues zafiro2'], [6, 'resume la relacion entre ambos zafiro3']]) {
    TOKENS.push(q.split(' ').pop());
    await enviar(q);
    await page.waitForFunction(() => window.__agios.dominus.consultando, null, { timeout: 5000, polling: 20 });
    await esperarRespuesta(i);
  }
  clearInterval(vigia);
  const msgs = await mensajesVisibles();
  const pie = await texto('.dm-chat .dm-ctx');
  const d = await dm();
  verdad(!panelVisto, 'el panel apareció sin fragmentos nuevos');
  verdad(msgs.filter(m => m.clase === 'yo').length === 3 && msgs.filter(m => m.clase === 'dom').length === 3 && d.mensajes === 6, JSON.stringify(msgs.map(m => m.clase)));
  verdad(/turno 3/.test(msgs[5].texto) && msgs[5].citas.length >= 1, msgs[5].texto);
  verdad(pie === `${d.fragmentos} fragmento${d.fragmentos === 1 ? '' : 's'} · 6 mensajes`, pie);
  verdad(await page.getAttribute('#consulta', 'placeholder') === 'Continúa la conversación…', 'placeholder');
  // cita → lector (su pieza, en ese pasaje)
  const n = msgs[1].citas[0];
  const frag = (await page.$$eval('.resultados-col:not([hidden]) .tarjeta:not(.dm-chat)', ts => ts.map(t => ({ n: t.querySelector('.dm-num')?.textContent, ref: t.querySelector('.ref').textContent })))).find(f => f.n === n);
  await page.$$eval('.dm-chat .dm-cita', (bs, k) => bs.find(b => b.dataset.n === k).click(), n);
  await page.waitForSelector('#lector.abierto');
  const lector = await page.evaluate(() => ({ titulo: document.getElementById('lectorTitulo').textContent, pasaje: document.querySelectorAll('#lectorTexto p.pasaje').length, nav: getComputedStyle(document.querySelector('#lector .nav')).display }));
  await captura('3b-cita-en-lector');
  await page.click('#cerrarLector');
  verdad(lector.titulo.startsWith(frag.ref) && lector.pasaje >= 1 && lector.nav !== 'none', JSON.stringify({ lector, frag }));
  // Qué se ha enviado
  await page.click('.dm-chat .dm-enviado'); await page.waitForSelector('#lector.abierto.libre');
  const ctxTxt = await texto('#lectorTexto');
  await captura('3b-que-se-ha-enviado');
  await page.click('#cerrarLector');
  verdad(ctxTxt.includes('Eres Dominus nostrum, el segundo cerebro de Anesthios') && ctxTxt.includes('[1]') && ctxTxt.includes('zafiro3') && ctxTxt.includes('Todo esto vive solo en la memoria'), ctxTxt.slice(0, 300));
  // «Cerrar todas» cierra la conversación; la siguiente pregunta la vuelve a abrir con los mismos mensajes
  await page.evaluate(() => document.getElementById('cerrarTodas').click());
  await page.waitForFunction(() => !document.querySelector('.dm-chat'), null, { timeout: 3000 });
  await enviar('una cuarta pregunta zafiro4'); TOKENS.push('zafiro4');
  await esperarRespuesta(8);
  const tras = await mensajesVisibles();
  verdad(tras.length >= 8 && tras[0].texto.includes('zafiro1'), 'la conversación no volvió con sus mensajes: ' + tras.length);
  await enviar('/Dominus nostrum');
  const limpio = await sinRastro(TOKENS);
  return { mensajes: d.mensajes, pie, cita: { n, lector: lector.titulo }, trasCerrarTodas: tras.length, limpio };
});

await paso('3c. Ventanas abiertas antes de activar: el panel las muestra; una ventana nueva desde un enlace → el panel muestra solo esa', async () => {
  await cambiarA('doctrina'); await libre();
  const antes = await buscar('Te fallé');
  verdad(antes[0]?.enlaces >= 1, 'la ventana no tiene enlace');
  await enviar('/Dominus nostrum'); await pausa(300);
  await enviar('que siente el narrador zafiro5'); TOKENS.push('zafiro5');
  await esperarPanel();
  const p1 = await page.$$eval('.dm-panel .dm-frag b', bs => bs.map(b => b.textContent));
  verdad(p1.length === antes.length && p1.join() === antes.map(v => v.ref).join(), JSON.stringify([p1, antes.map(v => v.ref)]));
  await captura('3c-panel-kyrien');
  await page.click('.dm-panel .dm-consultar');
  await esperarRespuesta(2);
  await captura('3c-conversacion-kyrien');
  // minimizar: las ventanas vuelven; tocar el enlace «Lect. Gonz. 145»
  await page.click('.dm-chat .dm-mini');
  await page.waitForFunction(() => !document.querySelector('.dm-replegado'), null, { timeout: 3000 });
  await pausa(500);
  await page.$eval(VIS + ' a.enlace', a => a.click());
  await page.waitForFunction(() => [...document.querySelectorAll('.resultados-col:not([hidden]) .tarjeta.visible')].some(t => t.dataset.corta === 'L·145'), null, { timeout: 8000 });
  await enviar('y que dice esta lectura zafiro6'); TOKENS.push('zafiro6');
  await esperarPanel();
  const p2 = await page.evaluate(() => ({ frags: [...document.querySelectorAll('.dm-panel .dm-frag b')].map(b => b.textContent), nums: [...document.querySelectorAll('.dm-panel .dm-n')].map(n => n.textContent), sub: document.querySelector('.dm-panel .dm-sub').textContent, nota: document.querySelector('.dm-panel .dm-nota').textContent }));
  await captura('3c-panel-solo-la-nueva');
  verdad(p2.frags.length === 1 && p2.frags[0] === 'Lect. Gonz. 145', JSON.stringify(p2));
  verdad(+p2.nums[0] === antes.length + 1 && /nuevos/.test(p2.sub) && new RegExp(`Ya tiene ${antes.length} fragmento`).test(p2.nota), JSON.stringify(p2));
  await page.click('.dm-panel .dm-consultar');
  await esperarRespuesta(4);
  const d = await dm();
  verdad(d.fragmentos === antes.length + 1, 'fragmentos: ' + d.fragmentos);
  // la cita de la ventana de Agios abierta en Kyrien abre su pieza en el lector
  const msgs = await mensajesVisibles();
  const c = msgs[3].citas.find(n => +n === antes.length + 1);
  if (c) {
    await page.$$eval('.dm-chat .dm-cita', (bs, k) => bs.find(b => b.dataset.n === k).click(), c);
    await page.waitForSelector('#lector.abierto');
    verdad((await texto('#lectorTitulo')).startsWith('Lect. Gonz. 145'), await texto('#lectorTitulo'));
    await page.click('#cerrarLector');
  }
  return { panel1: p1, panel2: p2.frags, numero: p2.nums[0], fragmentos: d.fragmentos };
});

/* ================================================================
   5. APAGAR (y 4. SIN CONECTAR)
   ================================================================ */
await paso('5a. Apagar al cambiar KYRIEN → AGIOS (de inmediato, antes de la transición): sin rastro', async () => {
  verdad((await dm()).encendido && (await dm()).mensajes >= 4, 'debía haber conversación');
  await page.click('#selector button[data-col="lecturas"]');
  await page.waitForFunction(() => !!window.__agios.cambio, null, { timeout: 5000, polling: 20 });
  const alEmpezar = await page.evaluate(() => ({ d: window.__agios.dominus, nums: document.querySelectorAll('.dm-num').length, caos: window.__agios.caos }));
  verdad(!alEmpezar.d.encendido && !alEmpezar.d.mensajes && alEmpezar.nums === 0 && alEmpezar.caos === 0 && alEmpezar.d.encogido.k === 1, JSON.stringify(alEmpezar));
  await page.waitForFunction(() => !window.__agios.cambio && window.__agios.activa === 'lecturas', null, { timeout: 120000, polling: 100 });
  return sinRastro(TOKENS);
});

await paso('5b. Apagar al tocar al asistente (también con una consulta en curso: se aborta y se descarta)', async () => {
  await libre();
  await buscar('Lect. Gonz. 23');
  await enviar('/Dominus nostrum'); await pausa(200);
  await enviar('que dice el salmo zafiro7'); TOKENS.push('zafiro7');
  await esperarPanel(); await page.click('.dm-panel .dm-consultar');
  await page.waitForFunction(() => window.__agios.dominus.consultando, null, { timeout: 5000, polling: 20 });
  await pausa(500);
  await tocar();
  await esperarModo('apagado', 5000);
  const r = await sinRastro(TOKENS);
  await pausa(3500);                                    // la respuesta de ejemplo habría llegado: se descartó
  verdad(!(await page.locator('.dm-chat').count()) && !(await dm()).mensajes, 'la respuesta abortada apareció');
  await tocar(); await esperarModo('activo');
  return r;
});

await paso('5c. Apagar al volver al menú: sin rastro', async () => {
  await buscar('Lect. Gonz. 23');
  await enviar('/Dominus nostrum'); await pausa(200);
  await enviar('que dice el salmo zafiro8'); TOKENS.push('zafiro8');
  const hayPanel = await esperarPanel().then(() => true).catch(() => false);
  if (hayPanel) await page.click('.dm-panel .dm-consultar');
  await esperarRespuesta(2);
  await page.click('#aInicio');
  await page.waitForFunction(() => !!window.__agios.viaje, null, { timeout: 5000, polling: 20 });
  verdad(!(await dm()).encendido, 'no se apagó al empezar a volver');
  await page.waitForFunction(() => !window.__agios.viaje && window.__agios.enMenu, null, { timeout: 120000, polling: 100 });
  const r = await sinRastro(TOKENS);
  await entrarA('lecturas'); await libre();
  return r;
});

await paso('5d. Apagar por tiempo (reloj adelantado 5 min solo en la prueba)', async () => {
  await buscar('Lect. Gonz. 24', { acumular: true });
  await enviar('/Dominus nostrum'); await pausa(200);
  await enviar('que dice esta lectura zafiro9'); TOKENS.push('zafiro9');
  await esperarPanel(); await page.click('.dm-panel .dm-consultar');
  await esperarRespuesta(2);
  // últimos 30 s: aviso en la conversación y el brillo late
  await page.evaluate(() => window.__adelantar(5 * 60000 - 25000));
  await page.waitForFunction(() => [...document.querySelectorAll('.dm-chat .dm-msg.aviso')].some(m => /Quedan 30 segundos/.test(m.textContent)), null, { timeout: 3000 });
  const metas = [];
  for (let i = 0; i < 12; i++) { metas.push(await page.evaluate(() => window.__agios.dominus.intensidad)); await pausa(90); }
  await captura('5d-ultimos-30s');
  await page.evaluate(() => window.__adelantar(30000));
  await page.waitForFunction(() => !window.__agios.dominus.encendido, null, { timeout: 3000, polling: 50 });
  const pista = await texto('#hint');
  verdad(/^Dominus nostrum se desactivó \(pasaron 5 minutos\) · conversación borrada$/.test(pista), pista);
  verdad(Math.max(...metas) - Math.min(...metas) > 0.03, 'el brillo no latió: ' + metas.map(x => x.toFixed(2)));
  return { pista, ...(await sinRastro(TOKENS)) };
});

await paso('5e. Tiempo cumplido con una consulta en curso: espera a que termine y luego se apaga', async () => {
  await enviar('/Dominus nostrum'); await pausa(200);
  await enviar('que dice esta lectura zafiro10'); TOKENS.push('zafiro10');
  const hayPanel = await esperarPanel().then(() => true).catch(() => false);
  if (hayPanel) await page.click('.dm-panel .dm-consultar');
  await page.waitForFunction(() => window.__agios.dominus.consultando, null, { timeout: 5000, polling: 20 });
  await page.evaluate(() => window.__adelantar(6 * 60000));
  await pausa(800);
  const durante = await dm();
  verdad(durante.encendido && durante.consultando && durante.restanteMs < 0, 'se apagó sin esperar la consulta: ' + JSON.stringify(durante));
  await page.waitForFunction(() => !window.__agios.dominus.encendido, null, { timeout: 8000, polling: 50 });
  const pista = await texto('#hint');
  verdad(/se desactivó \(pasaron 5 minutos\)/.test(pista), pista);
  return { durante: { encendido: durante.encendido, consultando: durante.consultando }, pista, ...(await sinRastro(TOKENS)) };
});

let peticionesSinConectar = null;
await paso('4. «Sin conectar» (por defecto): el aviso aparece y no hay NINGUNA petición de red', async () => {
  await ajuste('anesthios.dominus.cerebro', 'sin-conectar');
  await page.evaluate(() => localStorage.removeItem('anesthios.dominus.cerebro'));   // el de por defecto
  await libre();
  await buscar('Lect. Gonz. 23');
  const desde = peticiones.length, desdeSrv = srv.registro.length;
  await enviar('/Dominus nostrum'); await pausa(200);
  await enviar('que dice esta lectura zafiro11'); TOKENS.push('zafiro11');
  await esperarPanel();
  const nota = await texto('.dm-panel .dm-nota');
  verdad(/Cerebro: sin conectar — no se enviará nada/.test(nota), nota);
  await page.click('.dm-panel .dm-consultar');
  await page.waitForFunction(() => document.querySelector('.dm-chat .dm-msg.aviso'), null, { timeout: 5000 });
  await pausa(600);
  const msgs = await mensajesVisibles();
  const aviso = msgs.find(m => m.clase === 'aviso')?.texto;
  const destello = await g(() => window.__agios.destello);
  const d = await dm();
  await captura('4-sin-conectar');
  verdad(aviso === 'Dominus nostrum todavía no tiene un cerebro conectado. No se envió nada.', JSON.stringify(msgs));
  verdad(d.mensajes === 0, 'la pregunta fallida quedó en el contexto: ' + d.mensajes);
  verdad(destello.color === '#ff4d5e', 'sin destello rojo: ' + JSON.stringify(destello));
  // «Qué se ha enviado» y apagar: tampoco piden nada
  await page.click('.dm-chat .dm-enviado'); await page.waitForSelector('#lector.abierto.libre'); await page.click('#cerrarLector');
  await enviar('/Dominus nostrum');
  await pausa(500);
  const nuevas = peticiones.slice(desde), servidor = srv.registro.slice(desdeSrv);
  peticionesSinConectar = nuevas.length + servidor.length;
  verdad(!nuevas.length && !servidor.length, 'peticiones: ' + JSON.stringify([...nuevas, ...servidor].slice(0, 5)));
  return { nota: nota.split('Cerebro: ')[1], aviso, peticiones: 0, ...(await sinRastro(TOKENS)) };
});

await paso('4b. Tampoco la «Demostración» hace peticiones de red (ciclo completo)', async () => {
  await ajuste('anesthios.dominus.cerebro', 'demostracion');
  await buscar('Lect. Gonz. 24');
  const desde = peticiones.length, desdeSrv = srv.registro.length;
  await enviar('/Dominus nostrum'); await pausa(200);
  await enviar('que dice esta lectura zafiro12'); TOKENS.push('zafiro12');
  const hayPanel = await esperarPanel().then(() => true).catch(() => false);
  if (hayPanel) await page.click('.dm-panel .dm-consultar');
  await esperarRespuesta(2);
  await enviar('otra pregunta zafiro13'); TOKENS.push('zafiro13');
  await esperarRespuesta(4);
  await enviar('/Dominus nostrum'); await pausa(500);
  const nuevas = peticiones.slice(desde), servidor = srv.registro.slice(desdeSrv);
  verdad(!nuevas.length && !servidor.length, 'peticiones: ' + JSON.stringify([...nuevas, ...servidor].slice(0, 5)));
  return { peticiones: 0, ...(await sinRastro(TOKENS)) };
});

/* ================================================================
   6. /extender
   ================================================================ */
await paso('6. /extender: 7 + 5 → suma 3; luego ya no suma; al reactivar se reinicia', async () => {
  await libre();
  await enviar('/extender(5)'); await pausa(150);
  const apagado = await texto('#hint');
  verdad(/^Dominus nostrum no está activo\. Actívalo primero con \/Dominus nostrum$/.test(apagado), apagado);
  await enviar('/Dominus nostrum'); await pausa(200);
  const r0 = (await dm()).restanteMs;
  const atajo0 = await page.evaluate(() => ({ ver: !document.getElementById('sugExtender').hidden, txt: document.getElementById('sugExtender').textContent }));
  await enviar('/extender(7)'); await pausa(150);
  const p7 = await texto('#hint'), d7 = await dm();
  const atajo7 = await texto('#sugExtender');
  await enviar('/Extender( 5 )'); await pausa(150);
  const p5 = await texto('#hint'), d5 = await dm();
  const atajoFin = await g(() => document.getElementById('sugExtender').hidden);
  await enviar('/extender 1'); await pausa(150);
  const p1 = await texto('#hint'), d1 = await dm();
  await enviar('/extender()'); await pausa(150);
  const pVacio = await texto('#hint');
  verdad(atajo0.ver && atajo0.txt === '⏱ /extender(5)', JSON.stringify(atajo0));
  verdad(/^\+7 min · quedan (11:5\d|12:00) · puedes extender 3 min más$/.test(p7) && d7.extendido === 7 && Math.abs(d7.restanteMs - r0 - 7 * 60000) < 2000, p7 + ' ' + JSON.stringify(d7));
  verdad(atajo7 === '⏱ /extender(3)', 'atajo: ' + atajo7);
  verdad(/^Solo quedaban 3 min de extensión\. \+3 min · quedan (14:5\d|15:00) · ya no se puede extender más$/.test(p5) && d5.extendido === 10, p5);
  verdad(atajoFin, 'el atajo ⏱ debía ocultarse sin extensión disponible');
  verdad(p1 === 'Ya usaste los 10 min de extensión de esta activación' && d1.restanteMs <= d5.restanteMs, p1);
  verdad(pVacio === 'Escribe los minutos entre paréntesis, por ejemplo /extender(5)', pVacio);
  await enviar('/Dominus nostrum'); await pausa(150);
  await enviar('/Dominus nostrum'); await pausa(150);
  const re = await dm();
  const atajoRe = await page.evaluate(() => ({ ver: !document.getElementById('sugExtender').hidden, txt: document.getElementById('sugExtender').textContent }));
  verdad(re.extendido === 0 && re.restanteMs > 4.9 * 60000 && re.restanteMs <= 5 * 60000 && atajoRe.ver && atajoRe.txt === '⏱ /extender(5)', JSON.stringify(re));
  await enviar('/Dominus nostrum');
  return { p7, p5, p1, reactivado: Math.round(re.restanteMs / 1000) + ' s' };
});

/* ================================================================
   7. ENCOGIDO + CAMBIO DE ALTO + MINIMIZAR
   ================================================================ */
await paso('7. Encogido, teclado (cambio de alto) y minimizar: escena del tamaño real y rayos centrados en el asistente', async () => {
  await ajuste('anesthios.dominus.cerebro', 'demostracion');
  await buscar('Lect. Gonz. 40');
  await enviar('/Dominus nostrum'); await pausa(200);
  await enviar('que dice esta lectura zafiro14'); TOKENS.push('zafiro14');
  await esperarPanel(); await page.click('.dm-panel .dm-consultar');
  await esperarRespuesta(2);
  const medir = () => page.evaluate(() => {
    const z = document.getElementById('zona').getBoundingClientRect(), st = document.getElementById('stage');
    const capa = document.querySelector('.capa[data-col="lecturas"]'), cr = capa.getBoundingClientRect();
    const cv = capa.querySelector('canvas');
    const d = window.__agios.dominus;
    const ret = document.querySelector('.decor.t-agios .reticula').getBoundingClientRect();
    return {
      k: d.encogido.k, ty: d.encogido.ty, rayos: d.centroRayos,
      capa: { x: cr.left - z.left + cr.width / 2, y: cr.top - z.top + cr.height / 2, w: cr.width },
      reticula: { x: ret.left - z.left + ret.width / 2, y: ret.top - z.top + ret.height / 2 },
      stage: { w: st.clientWidth, h: st.clientHeight }, lienzo: { w: cv.width, h: cv.height },
      chatTop: document.querySelector('.dm-chat').offsetTop,
    };
  });
  const asentar = () => pausa(1600);
  const centrado = (m, nombre) => {
    // centro del modelo = centro de la caja de la capa (la cámara mira al origen)
    verdad(Math.abs(m.capa.x - m.rayos.x) < 3 && Math.abs(m.capa.y - m.rayos.y) < 3, `${nombre}: rayos ${JSON.stringify(m.rayos)} vs asistente ${JSON.stringify(m.capa)}`);
    verdad(m.lienzo.w === m.stage.w && m.lienzo.h === m.stage.h, `${nombre}: escena ${JSON.stringify(m.lienzo)} ≠ área ${JSON.stringify(m.stage)}`);
    verdad(Math.abs(m.reticula.x - m.rayos.x) < 3 && Math.abs(m.reticula.y - (m.rayos.y + 0.02 * m.stage.h * m.k)) < 4, `${nombre}: retícula ${JSON.stringify(m.reticula)}`);
  };
  await asentar();
  const a = await medir();
  await captura('7a-encogido');
  verdad(a.k < 1 && a.k >= 0.42 && a.rayos.y < a.chatTop, 'no se encogió: ' + JSON.stringify(a));
  centrado(a, 'encogido');
  await page.setViewportSize({ width: 390, height: 520 }); await asentar();       // abre el teclado
  const b = await medir();
  await captura('7b-teclado');
  centrado(b, 'teclado abierto');
  await page.setViewportSize({ width: 390, height: 844 }); await asentar();       // se cierra
  const c = await medir();
  centrado(c, 'teclado cerrado');
  verdad(Math.abs(c.k - a.k) < 0.01 && Math.abs(c.ty - a.ty) < 2, 'no volvió a su lugar: ' + JSON.stringify([a.k, a.ty, c.k, c.ty]));
  await page.click('.dm-chat .dm-mini'); await asentar();
  const d = await medir();
  await captura('7c-minimizada');
  verdad(d.k === 1 && d.ty === 0 && !(await page.locator('.dm-replegado').count()), 'al minimizar debía volver: ' + JSON.stringify(d));
  centrado(d, 'minimizada');
  await page.click('.dm-chat .dm-mini'); await asentar();
  const e = await medir();
  centrado(e, 'restaurada');
  await enviar('/Dominus nostrum');
  return { encogido: +a.k.toFixed(2), teclado: +b.k.toFixed(2), tecladoCerrado: +c.k.toFixed(2), minimizada: d.k, restaurada: +e.k.toFixed(2) };
});

/* ================================================================
   8. RENDIMIENTO (perfil de celular de gama media)
   ================================================================ */
await paso('8. Rendimiento: con el modo encendido no se traba (CPU ×4, vs el prototipo)', async () => {
  const fps = (p, ms = 5000) => p.evaluate(ms => new Promise(ok => {
    let n = 0, peor = 0, prev = performance.now(); const t0 = prev;
    const f = t => { n++; peor = Math.max(peor, t - prev); prev = t; if (t - t0 < ms) requestAnimationFrame(f); else ok({ fps: +(n / ((t - t0) / 1000)).toFixed(1), peorMs: Math.round(peor) }); };
    requestAnimationFrame(f);
  }), ms);
  const cdp = await ctx.newCDPSession(page);
  await libre(); await cerrarVentanas();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const apagadoModo = await fps(page);
  await enviar('/Dominus nostrum'); await pausa(1500);
  const efectos = [];
  const muestreo = setInterval(() => page.evaluate(() => window.__agios.dominus.msEfectos).then(x => efectos.push(x)).catch(() => {}), 200);
  const app = await fps(page);
  clearInterval(muestreo);
  const est = await dm();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await enviar('/Dominus nostrum');
  // el prototipo, en las mismas condiciones (contexto aparte: que el service worker no lo guarde)
  const ctxProto = await browser.newContext({ ignoreHTTPSErrors: !!ESPEJO, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block' });
  const proto = await ctxProto.newPage();
  await proto.goto(URL_APP + 'prototipo/dominus/agios.html'); await proto.waitForTimeout(2500);
  const pt = await proto.evaluate(() => {
    const st = document.getElementById('stage').getBoundingClientRect(); const cx = st.left + st.width / 2, cy = st.top + st.height / 2;
    for (let r = 0; r < st.width; r += 6) for (let a = 0; a < 6.28; a += 0.4) { const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); if (document.elementFromPoint(x, y)?.classList.contains('escena')) return { x, y }; }
    return { x: cx, y: cy };
  });
  await proto.mouse.click(pt.x, pt.y); await proto.waitForTimeout(600);
  await proto.fill('#consulta', '/Dominus nostrum'); await proto.press('#consulta', 'Enter'); await proto.waitForTimeout(1500);
  const cdp2 = await ctxProto.newCDPSession(proto);
  await cdp2.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const prototipo = await fps(proto);
  await cdp2.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await proto.screenshot({ path: path.join(SALIDA, '8-prototipo-modo-encendido.png') });
  await ctxProto.close();
  const prom = efectos.length ? +(efectos.reduce((s, x) => s + x, 0) / efectos.length).toFixed(2) : null;
  verdad(est.rayos <= 10 && est.chispas <= 70 && est.dprLienzo <= 1.5, JSON.stringify(est));
  verdad(app.fps >= prototipo.fps * 0.85, `la app (${app.fps} fps) va más lenta que el prototipo (${prototipo.fps} fps)`);
  return { cpu: '×4', sinModo: apagadoModo, conModo: app, prototipo, msLienzo2DPromedio: prom, rayos: est.rayos };
});

/* ================================================================
   9. CON caos = 0 LOS MODELOS SE VEN EXACTAMENTE COMO ANTES
   ================================================================ */
await paso(`9. caos = 0: Agios y Kyrien idénticos píxel a píxel a las escenas de ${BASE_ESCENAS}; caos > 0 sí cambia`, async () => {
  const viejo = n => execSync(`git -C "${RAIZ}" show ${BASE_ESCENAS}:js/escenas/${n}.js`).toString();
  const c9 = await browser.newContext({ ignoreHTTPSErrors: !!ESPEJO, viewport: { width: 400, height: 400 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const p = await c9.newPage(); vigilar(p);
  await p.route('**/js/escenas/*.js', r => r.fulfill({ contentType: 'text/javascript', path: path.join(RAIZ, new URL(r.request().url()).pathname) }));
  await p.route('**/__caos/**', async r => {
    const u = new URL(r.request().url());
    if (u.pathname.endsWith('.html')) return r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset=utf-8>
<script type="importmap">{"imports":{"three":"/__caos/three.module.js"}}</script>
<body style="margin:0;background:#000"><div id="c" style="position:relative;width:320px;height:320px"></div>
<script type="module">
import * as THREE from 'three';
const sembrada = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const nuevoS = () => ({ energy: 1, mult: 1, apertura: 0, temblor: 0, destello: { color: new THREE.Color('#7a6ff0'), k: 0, h: 0 }, particles: 90, rot: 0.4, rotVel: 0, tilt: 0.1, zoom: 1, T: 0, caos: 0 });
async function cuadros(url, estado, caos) {
  const mod = (await import(url)).default;
  const cont = document.getElementById('c'); cont.innerHTML = '';
  const aleatorio = Math.random;
  Math.random = sembrada(42);
  const S = nuevoS(); Object.assign(S, estado);
  const e = mod.crear(cont, S); e.redimensionar(320, 320);
  Math.random = () => 0.5;
  const cv = cont.querySelector('canvas'), aux = document.createElement('canvas'); aux.width = cv.width; aux.height = cv.height;
  const g = aux.getContext('2d', { willReadFrequently: true }), fotos = [];
  for (let i = 1; i <= 90; i++) {
    const t = i * 16.7; S.T += 16.7 * 0.85; S.caos = caos;
    e.dibujar(t, 16.7);
    if (i % 30 === 0) { g.clearRect(0, 0, aux.width, aux.height); g.drawImage(cv, 0, 0); fotos.push(g.getImageData(0, 0, aux.width, aux.height).data); }
  }
  e.destruir?.(); Math.random = aleatorio;
  return fotos;
}
window.comparar = async (nombre, estado) => {
  const a = await cuadros('/__caos/viejo/' + nombre + '.js', estado, 0);
  const b = await cuadros('/js/escenas/' + nombre + '.js', estado, 0);
  const c = await cuadros('/js/escenas/' + nombre + '.js', estado, 1);
  const dif = (x, y) => x.reduce((s, f, k) => { let d = 0; for (let i = 0; i < f.length; i += 4) if (f[i] !== y[k][i] || f[i + 1] !== y[k][i + 1] || f[i + 2] !== y[k][i + 2]) d++; return s + d; }, 0);
  const encendidos = a.reduce((s, f) => { let d = 0; for (let i = 0; i < f.length; i += 4) if (f[i] + f[i + 1] + f[i + 2] > 30) d++; return s + d; }, 0);
  return { iguales: dif(a, b), conCaos: dif(a, c), encendidos, cuadros: a.length };
};
window.listo = true;
</script>` });
    // three, por la misma ruta (una página servida así no puede pedir al espejo local en 127.0.0.1)
    if (u.pathname.endsWith('/three.module.js')) {
      if (ESPEJO) return r.fulfill({ contentType: 'text/javascript', path: path.join(ESPEJO, 'cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js') });
      return r.fulfill({ response: await r.fetch({ url: 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js' }) });
    }
    const n = u.pathname.split('/').pop().replace('.js', '');
    return r.fulfill({ contentType: 'text/javascript', body: viejo(n) });
  });
  await p.goto(URL_APP + '__caos/comparar.html');
  await p.waitForFunction(() => window.listo, null, { timeout: 30000 });
  const r = {};
  for (const n of ['agios', 'kyrien']) for (const [nombre, estado] of [['encendido', {}], ['apagado', { energy: 0 }], ['buscando', { mult: 2, temblor: 0 }], ['abierto', { apertura: 1 }]]) {
    r[`${n}-${nombre}`] = await p.evaluate(([n, e]) => window.comparar(n, e), [n, estado]);
  }
  await c9.close();
  for (const [k, v] of Object.entries(r)) {
    verdad(v.encendidos > 1000, `${k}: la escena no dibujó nada (${v.encendidos})`);
    verdad(v.iguales === 0, `${k}: ${v.iguales} píxeles distintos con caos = 0`);
  }
  verdad(Object.entries(r).filter(([k]) => /encendido/.test(k)).every(([, v]) => v.conCaos > 100), 'con caos = 1 no cambió nada: ' + JSON.stringify(r));
  return r;
});

await paso('Consola sin errores', async () => {
  const reales = errores.filter(e => !/ERR_CONNECTION_REFUSED|Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|fonts\.googleapis/.test(e));
  verdad(!reales.length, JSON.stringify(reales.slice(0, 5)));
  return { ignorados: errores.length - reales.length };
});

await browser.close();
await srv.cerrar();
rmSync(DIR_ANTERIOR, { recursive: true, force: true });
writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 2));
console.log(`\n${informe.length - fallos}/${informe.length} pasos correctos. Capturas en ${SALIDA}`);
process.exit(fallos ? 1 : 0);
