/* ============================================================
   Hojas: «Estructura detectada», menú e índice.
   ============================================================ */
import { escaparHtml as e } from './texto.js';

const $ = id => document.getElementById(id);
let alCerrar = null;

export function abrirHoja(titulo, html, { clase = '', cerrar = null } = {}) {
  $('hojaTitulo').textContent = titulo;
  $('hojaContenido').innerHTML = html;
  $('hojaContenido').scrollTop = 0;
  const caja = $('hoja').querySelector('.caja');
  caja.className = 'caja ' + clase;
  $('hoja').classList.add('abierta');
  alCerrar = cerrar;
  return $('hojaContenido');
}
export function cerrarHoja() {
  $('hoja').classList.remove('abierta');
  const f = alCerrar; alCerrar = null; f?.();
}
export const hojaAbierta = () => $('hoja').classList.contains('abierta');
$('cerrarHoja').onclick = cerrarHoja;
$('hoja').addEventListener('click', ev => { if (ev.target === $('hoja')) cerrarHoja(); });

const fecha = t => t ? new Date(t).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const tamano = b => b == null ? '—' : b < 1024 ** 2 ? `${(b / 1024).toFixed(0)} KB` : b < 1024 ** 3 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${(b / 1024 ** 3).toFixed(2)} GB`;

/** HTML de «Estructura detectada» a partir del informe del analizador. */
export function htmlEstructura(inf, { documento, error = false } = {}) {
  let h = '';
  if (documento) h += `<p style="margin:0 0 8px;color:var(--dim);font-size:13px">${e(documento.nombre)} · ${tamano(documento.tamano)}</p>`;
  if (!inf.ok || error) h += `<div class="mensaje-err">${e(inf.mensaje || 'No se pudo procesar el documento.')}</div>`;
  else h += `<div class="mensaje-ok">Documento procesado. Revisa abajo lo que se detectó.</div>`;
  h += '<h3>Resumen</h3><div class="cifras">' +
    inf.resumen.map(r => `<div class="cifra"><b>${e(r.valor)}</b><span>${e(r.etiqueta)}</span></div>`).join('') + '</div>';
  const a = inf.actualizacion;
  if (a) h += `<h3>Actualización</h3><p style="margin:0">${a.nuevas} nuevas · ${a.modificadas} modificadas · ${a.sinCambios} sin cambios · ${a.eliminadas} eliminadas. ` +
    `Solo las nuevas o modificadas se volvieron a procesar.</p>`;
  if (inf.avisos.length) {
    for (const av of inf.avisos) h += `<h3>${e(av.titulo)}</h3><ul>${av.items.map(i => `<li>${e(i)}</li>`).join('')}</ul>`;
  } else if (inf.ok) h += '<h3>Revisión</h3><p style="margin:0">Sin números faltantes, repetidos ni fuera de orden. Todos los encabezados se reconocieron.</p>';
  if (inf.muestra?.length) {
    h += '<h3>Muestra</h3>';
    for (const m of inf.muestra) {
      h += `<div class="muestra"><div style="font-weight:600;margin-bottom:2px">${e(m.titulo)}</div>` +
        m.lineas.map(l => `<div><span class="r">${e(l.ref)}</span> · ${e(l.titulo)}<div class="i">${e(l.inicio)}</div></div>`).join('') + '</div>';
    }
  }
  return h;
}

/** HTML del menú: documentos cargados, espacio usado y acciones. */
export function htmlMenu({ colecciones, uso, persistente, sinConexion }) {
  let h = '<h3>Documentos cargados</h3>';
  for (const c of colecciones) {
    const d = c.registro;
    h += `<div class="doc" data-col="${e(c.id)}"><div class="nombre">${e(c.nombre)}${c.activa ? ' <span style="color:var(--dim);font-weight:400">(en uso)</span>' : ''}</div>`;
    if (d) {
      const r = d.informe?.datos || {};
      h += `<div class="det">${e(d.documento?.nombre || '')} · ${tamano(d.documento?.tamano)} · cargado ${fecha(d.actualizado)}</div>` +
        `<div class="det">${r.conjuntos ?? '—'} conjuntos · ${r.lecturas ?? '—'} lecturas · ${r.salmos ?? '—'} salmos · ${r.evangelios ?? '—'} evangelios</div>` +
        `<div class="det">Búsqueda por significado: ${e(c.estadoIndice)}</div>` +
        `<div class="botones">${c.activa ? '' : `<button type="button" data-accion="usar">Usar</button>`}` +
        `<button type="button" data-accion="estructura">Estructura</button><button type="button" data-accion="indice">Índice</button>` +
        `<button type="button" class="peligro" data-accion="borrar">Borrar colección</button></div>`;
    } else {
      h += `<div class="det">Sin documento. Súbelo con 📎.</div>` +
        (c.activa ? '' : `<div class="botones"><button type="button" data-accion="usar">Usar</button></div>`);
    }
    h += '</div>';
  }
  h += '<h3>Espacio usado</h3>';
  if (uso) {
    const pct = uso.quota ? Math.min(100, 100 * uso.usage / uso.quota) : 0;
    h += `<div>${tamano(uso.usage)} de ${tamano(uso.quota)} disponibles</div><div class="barra-uso"><i style="width:${pct.toFixed(1)}%"></i></div>` +
      `<div class="det" style="font-size:12px;color:var(--dim)">Incluye el modelo de búsqueda (~118 MB) y las librerías en caché.</div>`;
  } else h += '<div>No disponible en este navegador.</div>';
  h += `<div style="margin-top:6px">Almacenamiento persistente: <b>${persistente ? 'sí' : 'no'}</b>` +
    (persistente ? '' : ` <button type="button" data-accion="persistir" style="margin-left:6px;font-size:12px;padding:5px 8px">Pedirlo</button>`) + '</div>';
  h += `<div>Uso sin conexión: <b>${sinConexion ? 'listo' : 'preparándose'}</b></div>`;
  h += '<h3>Privacidad</h3><p style="margin:0;color:var(--dim);font-size:13px">Tus documentos se leen y se guardan solo en este dispositivo. Anesthios nunca envía su texto por internet.</p>';
  return h;
}
