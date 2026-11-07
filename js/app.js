/* ============================================================
   Anesthios — página principal: máquina de estados del asistente,
   coreografía de la escena, subida y procesamiento del documento,
   búsqueda, ventanas, paneles, lector y menú.
   Interfaz según prototipo/anesthios/ (aprobado).
   Los datos guardados (IndexedDB «agios», colección «lecturas») no
   cambian: «Anesthios» es solo el nombre visible de la app.
   ============================================================ */
import * as THREE from 'three';
import { COLECCIONES, coleccion } from './colecciones.js';
import { ESCENAS } from './escenas/index.js';
import { cargarAnalizador } from './analizadores/index.js';
import { leerDocx } from './docx.js';
import * as db from './db.js';
import { crearLector } from './lector.js';
import { crearVentanas } from './ventanas.js';
import { crearTablero } from './tablero.js';
import { abrirHoja, cerrarHoja, hojaAbierta, htmlEstructura, htmlMenu } from './paneles.js';

const $ = id => document.getElementById(id);
const stage = $('stage'), zona = $('zona');

/* ---------- Colección activa ---------- */
let guardada = null;
try { guardada = localStorage.getItem('agios.coleccion'); } catch {}
const COL = coleccion(guardada) || COLECCIONES[0];
const A = await cargarAnalizador(COL.analizador);
const ASISTENTE = COL.asistente || COL.nombre;
$('nombreAsistente').textContent = ASISTENTE.toUpperCase();
$('subtituloAsistente').textContent = (COL.subtitulo || COL.nombre).toUpperCase();
$('subirTexto').textContent = COL.id === 'lecturas'
  ? 'Elige el .docx de Lecturas y Evangelios Gonzaleanos'
  : `Elige el .docx de ${COL.nombre}`;

/* ---------- Estado visual compartido con la escena ---------- */
const S = { energy: 0, mult: 1, apertura: 0, temblor: 0, destello: { color: new THREE.Color(), k: 0 },
  particles: 90, rot: 0, rotVel: 0, tilt: 0, zoom: 1, T: 0 };
const meta = { energy: 0, mult: 1, apertura: 0, temblor: 0 };   // hacia dónde se mueven suavemente

const escenaMod = (await ESCENAS[COL.escena]()).default;
const escena = escenaMod.crear(stage, S);
function layout() { const r = stage.getBoundingClientRect(); if (r.width && r.height) escena.redimensionar(r.width, r.height); }
new ResizeObserver(layout).observe(stage); layout();

/* ---------- Datos de la colección en la página ---------- */
let piezas = [];
async function cargarPiezas() {
  piezas = (await db.todos('piezas', 'coleccion', COL.id)).sort((a, b) => a.orden - b.orden);
}
const hayDocumento = () => piezas.length > 0;
const lector = crearLector({ A, piezas: () => piezas });
const tablero = crearTablero();
const ventanas = crearVentanas({
  zona, cont: $('resultados'), escena, S,
  alVerCompleto: r => lector.abrir(r.pieza, r.pasaje),
  alCambiar: lista => { tablero.abiertas(lista); $('cerrarTodas').classList.toggle('ver', lista.length > 1); },
});
$('cerrarTodas').onclick = () => ventanas.cerrarTodas();

/* Paneles con los datos YA guardados de la colección (funciona desde el
   primer momento con el documento que el usuario subió antes). */
async function refrescarTablero() {
  const [reg, pend, total] = await Promise.all([
    db.obtener('colecciones', COL.id),
    db.contar('fragmentos', 'pend', COL.id),
    db.contar('fragmentos', 'coleccion', COL.id),
  ]);
  tablero.coleccion({ conjuntos: reg?.informe?.datos?.conjuntos ?? null, fecha: reg?.actualizado ?? reg?.documento?.fecha ?? null });
  const pct = Math.floor(100 * (total - pend) / (total || 1));
  tablero.indice(!reg ? 'sin documento' : !pend ? '● listo' : reg.estado === 'sin-modelo' ? `pendiente ${pct}%` : `indexando ${pct}%`);
}

/* ---------- Worker ---------- */
const worker = new Worker(new URL('./trabajador.js', import.meta.url), { type: 'module' });
const esperando = new Map();
let idBusqueda = 0;
let contexto = null;            // 'nuevo' | 'reanudar' (cómo empezó el procesamiento actual)
let ultimoInforme = null;
worker.onmessage = ({ data: m }) => {
  switch (m.tipo) {
    case 'progreso':
      if (modo !== 'procesando') break;
      if (m.fase === 'indexando') {
        etiqueta(`procesando ${Math.floor(100 * m.pct)}% · ${m.hechas}/${m.total} piezas`);
        tablero.indice(`indexando ${Math.floor(100 * m.pct)}%`);
        const h = $('hint').textContent;
        if (m.pct < 1 && (!h || h.startsWith('Preparando'))) pista('Creando el índice para buscar por significado. Con un documento grande puede tardar varios minutos; si se interrumpe, continuará donde se quedó.');
      }
      else etiqueta(m.texto || 'procesando…');
      break;
    case 'modelo':
      if (modo === 'procesando') pista(m.pct < 1
        ? `Descargando el modelo de búsqueda: ${Math.floor(100 * m.pct)}% de ${Math.round(m.mb)} MB (solo la primera vez)`
        : 'Preparando la búsqueda por significado…');
      break;
    case 'estructura':
      ultimoInforme = m.informe;
      cargarPiezas();
      refrescarTablero();
      pista(m.aIndexar
        ? `Estructura detectada: ${m.informe.datos.conjuntos} conjuntos. Preparando la búsqueda por significado de ${m.aIndexar} pieza(s)…`
        : `Estructura detectada: ${m.informe.datos.conjuntos} conjuntos. No hubo cambios que procesar.`);
      break;
    case 'sin-estructura':
      fallo('sin estructura', m.informe.mensaje, m.informe);
      break;
    case 'listo':
      terminarBien(m);
      break;
    case 'error':
      fallo('no se pudo procesar', m.mensaje);
      break;
    case 'resultados': {
      const f = esperando.get(m.id);
      if (f) { esperando.delete(m.id); f(m); }
      break;
    }
  }
};
worker.onerror = ev => { console.error(ev); if (modo === 'procesando') fallo('no se pudo procesar', 'Error interno del procesador: ' + (ev.message || '')); };

/* ---------- Máquina de estados del asistente ---------- */
let modo = 'apagado';
const etiquetas = { apagado: 'apagado', activo: 'activo', esperando: 'esperando archivo', procesando: 'procesando',
  exito: 'archivo listo', error: 'no válido', buscando: 'buscando' };
function poner(m, texto) {
  modo = m; etiqueta(texto || etiquetas[m]);
  const on = m !== 'apagado';
  $('chip').className = 'chip-estado' + (m === 'exito' ? ' ok' : m === 'error' ? ' err' : on ? ' on' : '');
  $('tituloCol').classList.toggle('apagado', !on);
  meta.energy = on ? 1 : 0;
  meta.mult = { procesando: 3, buscando: 2 }[m] || 1;
  meta.apertura = m === 'esperando' ? 1 : 0;
  meta.temblor = m === 'procesando' ? 1 : 0;
  clearTimeout(poner.t);
  if (m === 'esperando') poner.t = setTimeout(() => $('subir').classList.add('abierta'), 380); else $('subir').classList.remove('abierta');
  const libre = m === 'activo';
  $('consulta').disabled = $('btnSubir').disabled = $('btnBuscar').disabled = !libre;
  document.querySelectorAll('#sugerencias button:not(#cerrarTodas)').forEach(b => { b.disabled = !libre; });
  $('consulta').placeholder = !on ? `Toca a ${ASISTENTE} para encenderlo`
    : m === 'procesando' ? `${ASISTENTE} está procesando tu documento…`
    : hayDocumento() ? `Pídele a ${ASISTENTE} una lectura, un evangelio o una idea…` : 'Sube tu documento con 📎';
  if (!on) pista('');
  else if (m === 'activo' && !pista.fija) pista(hayDocumento() ? '' : 'Toca 📎 para subir tu documento .docx');
  if (m === 'apagado' && actualizacionPendiente) recargarConVersionNueva();
}
function etiqueta(t) { $('estado').textContent = t; }
function pista(t, clase = '', fijaMs = 0) {
  const h = $('hint'); h.textContent = t; h.className = clase;
  clearTimeout(pista.t); pista.fija = !!fijaMs;
  if (fijaMs) pista.t = setTimeout(() => { pista.fija = false; if (h.textContent === t) { h.textContent = ''; h.className = ''; } }, fijaMs);
}
function destellar(hex) { S.destello.color.set(hex); S.destello.k = 1; S.destello.h = 900; }

/* Encender / apagar con un toque sobre Agios */
function alternar() {
  if (modo === 'apagado') { poner('activo'); if (hayDocumento()) worker.postMessage({ tipo: 'precargar' }); }
  else if (modo === 'activo') { ventanas.cerrarTodas(); poner('apagado'); }
}

/* ---------- Subir archivo ---------- */
$('btnSubir').onclick = () => { colocarVentana(); poner('esperando'); };   // subir ya no cierra las ventanas
$('cancelarSubir').onclick = () => poner('activo');
$('elegir').onclick = () => $('archivo').click();
$('archivo').onchange = ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) procesarArchivo(f); };
function colocarVentana() {
  const c = escena.proyectar(new THREE.Vector3(0, 0, 0)); const v = $('subir');
  v.style.left = c.x + 'px'; v.style.top = (c.y + Math.min(170, zona.clientHeight * 0.27)) + 'px';
}

/* Pantalla encendida mientras procesa (Screen Wake Lock API) */
let candado = null;
async function mantenerPantalla() {
  try { if ('wakeLock' in navigator && !candado && document.visibilityState === 'visible') { candado = await navigator.wakeLock.request('screen'); candado.addEventListener('release', () => { candado = null; }); } } catch {}
}
function soltarPantalla() { try { candado?.release(); } catch {} candado = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && modo === 'procesando') mantenerPantalla();
});

async function procesarArchivo(file) {
  poner('procesando', 'leyendo documento…');   // la ventana se retrae y el núcleo se cierra
  contexto = 'nuevo';
  pista('');
  mantenerPantalla();
  try { navigator.storage?.persist?.(); } catch {}
  let buffer;
  try { buffer = await file.arrayBuffer(); }
  catch { return fallo('archivo no válido', 'No se pudo leer el archivo.'); }
  const documento = { nombre: file.name, tamano: file.size, fecha: file.lastModified || Date.now() };
  // Se guarda una copia local para poder continuar si se interrumpe (no sale del dispositivo).
  try { await db.guardar('trabajos', { coleccion: COL.id, archivo: buffer, documento, inicio: Date.now() }); } catch {}
  await leerYEnviar(buffer, documento);
}

async function leerYEnviar(buffer, documento) {
  let parrafos;
  try {
    parrafos = await leerDocx(buffer, f => { if (modo === 'procesando') etiqueta(`leyendo documento ${Math.floor(100 * f)}%`); });
  } catch (e) {
    await db.borrar('trabajos', COL.id).catch(() => {});
    return fallo(e.codigo === 'no-docx' ? 'archivo no válido' : 'no se pudo procesar', e.message);
  }
  worker.postMessage({ tipo: 'procesar', coleccion: COL.id, analizador: COL.analizador, documento, parrafos });
}

function fallo(texto, detalle, informe = null) {
  soltarPantalla();
  refrescarTablero();
  destellar('#ff4d5e'); poner('error', texto);
  pista(detalle || '', 'err', 9000);
  if (informe) setTimeout(() => abrirHoja('Estructura detectada', htmlEstructura(informe, { error: true }), { clase: 'err' }), 700);
  setTimeout(() => { if (modo === 'error') poner('activo'); }, 1800);
}

async function terminarBien(m) {
  soltarPantalla();
  await cargarPiezas();
  refrescarTablero();
  destellar('#3ddc84'); poner('exito');
  if (m.semantica === 'pendiente')
    pista('Documento listo para búsqueda exacta. La búsqueda por significado se completará cuando haya conexión para descargar el modelo (una sola vez).', 'ok', 12000);
  else pista('');
  const reg = await db.obtener('colecciones', COL.id);
  if (contexto === 'nuevo' && (ultimoInforme || reg?.informe))
    setTimeout(() => abrirHoja('Estructura detectada', htmlEstructura(ultimoInforme || reg.informe, { documento: reg?.documento }), { clase: 'ok' }), 900);
  contexto = null;
  setTimeout(() => { if (modo === 'exito') poner('activo'); }, 1800);
}

/* Si se interrumpió (se cerró la app, se apagó la pantalla…), continúa donde se quedó. */
async function reanudarSiHaceFalta() {
  const trabajo = await db.obtener('trabajos', COL.id).catch(() => null);
  if (trabajo?.archivo) {
    contexto = 'nuevo';
    poner('procesando', 'reanudando…'); mantenerPantalla();
    pista('Continuando con el documento que se estaba procesando…');
    await leerYEnviar(trabajo.archivo, trabajo.documento);
    return;
  }
  const [reg, pend] = await Promise.all([db.obtener('colecciones', COL.id), db.contar('fragmentos', 'pend', COL.id)]);
  if (reg && pend && (reg.estado !== 'sin-modelo' || navigator.onLine)) {
    contexto = 'reanudar';
    poner('procesando', 'reanudando…'); mantenerPantalla();
    pista('Continuando donde se quedó…');
    worker.postMessage({ tipo: 'reanudar', coleccion: COL.id });
  }
}

/* ---------- Buscar y mostrar ---------- */
function pedirBusqueda(consulta) {
  const id = ++idBusqueda;
  return new Promise(ok => {
    esperando.set(id, ok);
    worker.postMessage({ tipo: 'buscar', id, coleccion: COL.id, analizador: COL.analizador, consulta });
  });
}
async function buscar(q) {
  q = (q || '').trim();
  if (!q || modo !== 'activo') return;
  $('consulta').value = q;
  $('consulta').blur();
  poner('buscando'); pista('');                       // las ventanas anteriores se quedan
  const t0 = performance.now();
  const r = await pedirBusqueda(q);
  const resto = 900 - (performance.now() - t0);        // que se vea la búsqueda (x2)
  if (resto > 0) await new Promise(ok => setTimeout(ok, resto));
  const n = r.resultados.length;
  poner('activo', n ? `${n} resultado${n === 1 ? '' : 's'}` : 'sin resultados');
  if (r.aviso) pista(r.aviso, n ? '' : 'err', 8000);
  else if (!n) pista('No encontré ese texto en tu documento.', 'err', 6000);
  ventanas.mostrar(r.resultados.map(x => ({ ...x, corta: corta(x) })));
  recordar(q);
}
$('form').onsubmit = ev => { ev.preventDefault(); buscar($('consulta').value); };

/* Etiqueta corta de una pieza para el panel: L·23, S·87, E·24 */
function corta(r) {
  const t = A.TIPOS[r.tipoPieza];
  return t ? `${(t.corto || t.nombre)[0].toUpperCase()}·${r.numero}` : 'Intro';
}

/* ---------- Sugerencias: últimas 3 búsquedas (o ejemplos) e Índice ---------- */
const CLAVE_RECIENTES = 'anesthios.recientes';
const EJEMPLOS = ['Evang. Gonz. 145', 'salmo 87', 'la misericordia del Padre'];
function leerRecientes() {
  try { const v = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 3) : []; }
  catch { return []; }
}
function recordar(q) {
  const lista = [q, ...leerRecientes().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 3);
  try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista)); } catch {}
  pintarSugerencias();
}
function pintarSugerencias() {
  const r = leerRecientes();
  const cont = $('recientes'); cont.innerHTML = '';
  for (const q of r.length ? r : EJEMPLOS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.q = q; b.textContent = q; b.disabled = modo !== 'activo';
    b.onclick = () => buscar(q);
    cont.append(b);
  }
}
$('sugIndice').onclick = () => lector.abrirIndice();

/* ---------- Menú ---------- */
$('btnMenu').onclick = abrirMenu;
async function abrirMenu() {
  const cols = await Promise.all(COLECCIONES.map(async c => {
    const registro = await db.obtener('colecciones', c.id);
    let estadoIndice = '—';
    if (registro) {
      const [pend, total] = await Promise.all([db.contar('fragmentos', 'pend', c.id), db.contar('fragmentos', 'coleccion', c.id)]);
      estadoIndice = !pend ? 'lista' : `${Math.floor(100 * (total - pend) / (total || 1))}% (${pend} fragmentos pendientes${registro.estado === 'sin-modelo' ? '; falta descargar el modelo' : ''})`;
    }
    return { ...c, registro, estadoIndice, activa: c.id === COL.id };
  }));
  let uso = null, persistente = false;
  try { uso = await navigator.storage.estimate(); } catch {}
  try { persistente = await navigator.storage.persisted(); } catch {}
  const sinConexion = !!navigator.serviceWorker?.controller;
  const cont = abrirHoja('Menú', htmlMenu({ colecciones: cols, uso, persistente, sinConexion }));
  cont.querySelectorAll('[data-accion]').forEach(b => b.onclick = async () => {
    const id = b.closest('[data-col]')?.dataset.col;
    const reg = cols.find(c => c.id === id)?.registro;
    switch (b.dataset.accion) {
      case 'estructura': if (reg?.informe) abrirHoja('Estructura detectada', htmlEstructura(reg.informe, { documento: reg.documento }), { clase: 'ok' }); break;
      case 'indice': cerrarHoja(); lector.abrirIndice(); break;
      case 'usar': try { localStorage.setItem('agios.coleccion', id); } catch {} location.reload(); break;
      case 'persistir': try { await navigator.storage.persist(); } catch {} abrirMenu(); break;
      case 'borrar':
        if (modo === 'procesando') { alert('Espera a que termine el procesamiento.'); break; }
        if (!confirm(`¿Borrar la colección «${cols.find(c => c.id === id).nombre}» de este dispositivo? Tendrás que volver a subir el documento.`)) break;
        await db.borrarColeccion(id);
        worker.postMessage({ tipo: 'invalidar', coleccion: id });
        if (id === COL.id) { piezas = []; ventanas.cerrarTodas(); lector.cerrar(); refrescarTablero(); if (modo === 'activo') poner('activo'); }
        abrirMenu();
        break;
    }
  });
}

/* ---------- Gestos: tocar = encender/apagar, arrastrar = girar, pellizcar = zoom ---------- */
const ptrs = new Map(); let down = null, pinch0 = null;
stage.addEventListener('pointerdown', ev => { stage.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (ptrs.size === 1) down = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: false };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: S.zoom }; if (down) down.moved = true; } });
stage.addEventListener('pointermove', ev => { const p = ptrs.get(ev.pointerId); if (!p) return;
  const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
  if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; S.zoom = Math.max(0.5, Math.min(2.5, pinch0.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d)); return; }
  if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 8) down.moved = true;
  if (down && down.moved) { S.rot += dx * 0.008; S.rotVel = dx * 0.008; S.tilt = Math.max(-0.3, Math.min(0.7, S.tilt + dy * 0.004)); } });
function up(ev) { ptrs.delete(ev.pointerId); if (ptrs.size < 2) pinch0 = null;
  if (ptrs.size === 0 && down) { if (!down.moved && performance.now() - down.t < 300) alternar(); down = null; } }
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
stage.addEventListener('wheel', ev => { ev.preventDefault(); S.zoom = Math.max(0.5, Math.min(2.5, S.zoom * Math.exp(-ev.deltaY * 0.001))); }, { passive: false });
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (hojaAbierta()) cerrarHoja(); else if ($('lector').classList.contains('abierto')) lector.cerrar();
  else if (modo === 'esperando') poner('activo');
});

/* ---------- Bucle ---------- */
let last = performance.now();
const suave = (a, b, dT, k) => a + (b - a) * (1 - Math.pow(k, dT / 16.7));
function loop(t) {
  const dT = Math.min(50, Math.max(0, t - last)); last = t;
  S.energy = suave(S.energy, meta.energy, dT, 0.95);
  S.mult = suave(S.mult, meta.mult, dT, 0.93);
  S.apertura = suave(S.apertura, meta.apertura, dT, 0.9);
  S.temblor = suave(S.temblor, meta.temblor, dT, 0.9);
  S.destello.h = Math.max(0, (S.destello.h || 0) - dT); if (S.destello.h <= 0) S.destello.k = Math.max(0, S.destello.k - dT / 900);
  S.T += dT * 0.85 * S.mult * (0.15 + 0.85 * S.energy);
  if (!down) { S.rot += S.rotVel; S.rotVel *= Math.pow(0.94, dT / 16.7); }
  if (modo === 'esperando') colocarVentana();
  tablero.cuadro(S, dT);
  escena.dibujar(t, dT); requestAnimationFrame(loop);
}

/* ---------- Arranque ---------- */
let actualizacionPendiente = false;
await cargarPiezas().catch(() => {});
await refrescarTablero().catch(() => {});
poner('apagado'); pintarSugerencias(); requestAnimationFrame(loop);
reanudarSiHaceFalta().catch(e => console.error(e));

/* Service worker: caché versionada para uso sin conexión.
   Cuando se instala una versión nueva de la app, se recarga en un momento
   tranquilo (Agios apagado o la app en segundo plano), nunca a media tarea.
   Los datos guardados no se tocan. */
function recargarConVersionNueva() {
  if (modo === 'procesando' || modo === 'buscando') return;
  location.reload();
}
if ('serviceWorker' in navigator) {
  const habiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador) return;              // primera instalación: nada que recargar
    actualizacionPendiente = true;
    if (modo === 'apagado') recargarConVersionNueva();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && actualizacionPendiente) recargarConVersionNueva();
  });
  // Buscar versión nueva al abrir y cada vez que se vuelve a la app (el
  // navegador por sí solo lo hace con demora).
  const buscarVersion = () => navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscarVersion(); });
  navigator.serviceWorker.register('./sw.js').then(buscarVersion).catch(e => console.warn('SW', e));
}

/* Estado de solo lectura para diagnóstico y pruebas automáticas */
Object.defineProperty(window, '__agios', { value: Object.freeze({
  get modo() { return modo; }, get destello() { return { k: S.destello.k, color: '#' + S.destello.color.getHexString() }; },
  get meta() { return { ...meta }; }, get piezas() { return piezas.length; }, coleccion: COL.id,
  get ventanas() { return ventanas.abiertas(); }, get S() { return { rot: S.rot, energy: S.energy }; }, app: 'Anesthios',
}) });
