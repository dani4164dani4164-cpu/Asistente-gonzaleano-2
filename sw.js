/* ============================================================
   Service worker de Agios: caché versionada para uso sin conexión.
   - App (este sitio): se precarga al instalar; al cambiar VERSION se
     instala una caché nueva y se borra la anterior.
   - Librerías de jsDelivr (URLs con versión fija, inmutables): caché
     aparte, primero caché.
   - El modelo de Hugging Face lo guarda transformers.js en su propia
     caché del navegador; aquí no se toca.
   Este archivo nunca ve ni envía el texto de tus documentos.
   ============================================================ */
const VERSION = 'agios-app-v1';
const CDN = 'agios-cdn-v1';

const APP = [
  './', './index.html', './manifest.webmanifest', './css/estilos.css',
  './js/app.js', './js/config.js', './js/colecciones.js', './js/db.js', './js/docx.js',
  './js/lector.js', './js/paneles.js', './js/texto.js', './js/ordinales.js', './js/trabajador.js',
  './js/escenas/index.js', './js/escenas/agios.js',
  './js/analizadores/index.js', './js/analizadores/lecturas.js',
  './js/motor/buscador.js', './js/motor/fragmentos.js',
  './iconos/icono.svg', './iconos/icono-180.png', './iconos/icono-192.png', './iconos/icono-512.png', './iconos/icono-maskable-512.png',
];
/* Mismas versiones que el import map de index.html y js/config.js */
const LIBRERIAS = [
  'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.mjs',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.wasm',
];

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const app = await caches.open(VERSION);
    await app.addAll(APP.map(u => new Request(u, { cache: 'reload' })));
    // Librerías: mejor esfuerzo (si falla alguna, se guardará al usarla).
    const cdn = await caches.open(CDN);
    await Promise.allSettled(LIBRERIAS.map(async u => {
      if (await cdn.match(u)) return;
      const r = await fetch(u, { mode: 'cors' });
      if (r.ok) await cdn.put(u, r);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys())
      if (k.startsWith('agios-') && k !== VERSION && k !== CDN) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    ev.respondWith((async () => {
      const app = await caches.open(VERSION);
      const enCache = await app.match(req, { ignoreSearch: true }) ||
        (req.mode === 'navigate' ? await app.match('./index.html') : null);
      if (enCache) return enCache;
      try {
        const r = await fetch(req);
        if (r.ok && url.pathname.startsWith(new URL('./', self.location).pathname)) app.put(req, r.clone());
        return r;
      } catch (e) {
        if (req.mode === 'navigate') return app.match('./index.html');
        throw e;
      }
    })());
    return;
  }

  if (url.hostname === 'cdn.jsdelivr.net') {
    ev.respondWith((async () => {
      const cdn = await caches.open(CDN);
      const enCache = await cdn.match(req.url);
      if (enCache) return enCache;
      const r = await fetch(req);
      if (r.ok) cdn.put(req.url, r.clone());
      return r;
    })());
  }
  // Todo lo demás (p. ej. el modelo en huggingface.co) pasa sin tocarse.
});
