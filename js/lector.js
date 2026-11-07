/* ============================================================
   Lector: la pieza entera, tal como está en el documento.
   Lecturas: anterior/siguiente del mismo tipo, saltos entre Lectura,
   Salmo y Evangelio del mismo conjunto e índice por número.
   Doctrina: anterior/siguiente en orden del documento, ruta e índice
   en árbol. Las citas a otras colecciones son enlaces.
   ============================================================ */
import { escaparHtml as e, resaltarHtml } from './texto.js';
import { abrirHoja, cerrarHoja, htmlArbol } from './paneles.js';

const $ = id => document.getElementById(id);

/**
 * ctx: {
 *   datos(colId) → {A, piezas, tema}   datos de una colección
 *   activa() → colId                   colección del asistente activo
 *   enlazar(html, colId) → html        convierte citas en enlaces (Kyrien)
 *   alEnlace(a)                        al tocar un enlace
 * }
 */
export function crearLector(ctx) {
  let actual = null, prev = null, next = null, colActual = null;

  function abrir(id, pasaje = null, colId = ctx.activa()) {
    const { A, piezas, tema } = ctx.datos(colId);
    const p = piezas.find(x => x.id === id);
    if (!p) return false;
    actual = p; colActual = colId;
    const reales = piezas.filter(q => !q.repetida);
    const et = A.etiqueta(p);
    $('lector').dataset.tema = tema;
    $('lectorTitulo').innerHTML = `${e(et.ref)}<small>${e(et.tipo)}</small>`;

    // Anterior / siguiente: mismo tipo (Lecturas) o en orden del documento (Doctrina)
    const mismos = A.NAVEGACION === 'orden' ? reales.slice().sort((a, b) => a.orden - b.orden)
      : p.tipo === 'introduccion' ? [] : reales.filter(q => q.tipo === p.tipo).sort((a, b) => a.numero - b.numero);
    const i = mismos.indexOf(p);
    prev = i > 0 ? mismos[i - 1] : null;
    next = i >= 0 && i < mismos.length - 1 ? mismos[i + 1] : null;
    $('lecAnterior').disabled = !prev;
    $('lecSiguiente').disabled = !next;
    $('lecAnterior').title = prev ? A.etiqueta(prev).ref : 'No hay anterior';
    $('lecSiguiente').title = next ? A.etiqueta(next).ref : 'No hay siguiente';

    // Lecturas: saltar entre Lectura, Salmo y Evangelio del mismo conjunto.
    // Doctrina: la ruta (bloque › capítulo) y sus etiquetas.
    const tipos = $('lecTipos');
    tipos.innerHTML = '';
    if (A.NAVEGACION === 'orden') {
      const ruta = (p.ruta || []).slice(0, -1);
      tipos.innerHTML = `<span class="ruta">${ruta.map(x => e(x)).join(' › ')}</span>` + (p.etiquetas || []).map(t => `<span class="etq">${e(t)}</span>`).join('');
    } else if (p.tipo !== 'introduccion') {
      const hermanas = reales.filter(q => q.grupo === p.grupo && q.tipo !== 'introduccion');
      for (const [t, info] of Object.entries(A.TIPOS)) {
        const q = hermanas.find(x => x.tipo === t);
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = info.corto; b.dataset.tipo = t;
        b.disabled = !q; if (!q) b.title = `El ${A.NOMBRE_GRUPO || 'grupo'} ${p.grupo} no tiene ${info.nombre}`;
        if (q === p) b.classList.add('actual');
        b.onclick = () => q && abrir(q.id, null, colId);
        tipos.append(b);
      }
    }

    // Texto completo, con las marcas (autor, cierres, cantos) conservadas
    const marcaDe = t => A.tipoDeMarca ? A.tipoDeMarca(t) : null;
    const resaltes = mapaDeResaltes(p, pasaje, A);
    let html = `<div class="cuerpo"><h2>${e(p.titulo || et.ref)}</h2>`;
    p.parrafos.forEach((t, k) => {
      const m = marcaDe(t);
      const enPasaje = pasaje && k >= pasaje.parrafoIni && k <= pasaje.parrafoFin;
      const cls = [m ? 'm-' + m : '', enPasaje ? 'pasaje' : ''].filter(Boolean).join(' ');
      html += `<p data-k="${k}"${cls ? ` class="${cls}"` : ''}>${ctx.enlazar(resaltarHtml(t, resaltes.get(k)), colId)}</p>`;
    });
    if (!p.parrafos.length) html += '<p style="opacity:.7">(Esta pieza no tiene texto en el documento.)</p>';
    html += '</div>';
    const art = $('lectorTexto');
    art.innerHTML = html;
    $('lector').classList.add('abierto');
    requestAnimationFrame(() => {
      const objetivo = pasaje ? art.querySelector(`p[data-k="${pasaje.parrafoIni}"]`) : null;
      if (objetivo) art.scrollTop = Math.max(0, objetivo.offsetTop - art.offsetTop - 80);
      else art.scrollTop = 0;
    });
    return true;
  }

  function cerrar() { $('lector').classList.remove('abierto'); actual = null; }

  function abrirIndice(colId = colActual && $('lector').classList.contains('abierto') ? colActual : ctx.activa()) {
    const { A, piezas } = ctx.datos(colId);
    const todas = piezas.filter(p => !p.repetida);
    let cont;
    if (A.arbolIndice) {
      // Doctrina: árbol Bloque → Capítulo → Sección
      let h = `<form class="ir" id="formIr"><input id="irA" placeholder="Título, bloque o fecha (p. ej. Logos 7 de agosto de 2017)" autocomplete="off" enterkeyhint="go"><button class="prim" type="submit">Ir</button></form>`;
      h += todas.length ? htmlArbol(A.arbolIndice(todas.slice().sort((a, b) => a.orden - b.orden)), { botones: true }) : '<p>No hay piezas todavía.</p>';
      cont = abrirHoja('Índice', h);
      cont.querySelectorAll('button.ir-pieza').forEach(b => b.onclick = ev => { ev.preventDefault(); cerrarHoja(); abrir(b.dataset.id, null, colId); });
      cont.querySelector('#formIr').onsubmit = ev => {
        ev.preventDefault();
        const r = A.resolverReferencia(cont.querySelector('#irA').value.trim(), todas);
        if (r?.ids?.length) { cerrarHoja(); abrir(r.ids[0], null, colId); }
        else noExiste(cont);
      };
      return;
    }
    const grupos = new Map();
    for (const p of todas) if (p.tipo !== 'introduccion') {
      if (!grupos.has(p.grupo)) grupos.set(p.grupo, []);
      grupos.get(p.grupo).push(p);
    }
    const intro = todas.find(p => p.tipo === 'introduccion');
    const nTipos = Object.keys(A.TIPOS).length;
    const nums = [...grupos.keys()].sort((a, b) => a - b);
    let h = `<form class="ir" id="formIr"><input id="irA" placeholder="Número o referencia (p. ej. evangelio 145)" autocomplete="off" enterkeyhint="go"><button class="prim" type="submit">Ir</button></form>`;
    if (intro) h += `<p style="margin:0 0 10px"><button type="button" data-id="${e(intro.id)}">Introducción</button></p>`;
    if (!nums.length) h += '<p>No hay piezas todavía.</p>';
    else h += `<p style="margin:0 0 8px;opacity:.75;font-size:12px">Toca un número para abrir su ${e(A.TIPOS[Object.keys(A.TIPOS)[0]].nombre)}. Con borde punteado: le falta alguna pieza.</p>`;
    h += '<div class="rejilla">' + nums.map(n => {
      const g = grupos.get(n).sort((a, b) => A.TIPOS[a.tipo].orden - A.TIPOS[b.tipo].orden);
      const faltan = g.length < nTipos;
      return `<button type="button" data-id="${e(g[0].id)}"${faltan ? ' class="parcial" title="Incompleto"' : ''}>${n}</button>`;
    }).join('') + '</div>';
    cont = abrirHoja('Índice', h);
    cont.querySelectorAll('button[data-id]').forEach(b => b.onclick = () => { cerrarHoja(); abrir(b.dataset.id, null, colId); });
    cont.querySelector('#formIr').onsubmit = ev => {
      ev.preventDefault();
      const q = cont.querySelector('#irA').value.trim();
      const ref = A.parsearReferencia(q);
      let p = null;
      if (ref?.tipo === 'introduccion') p = intro;
      else if (ref?.tipo === 'conjunto') p = grupos.get(ref.numero)?.[0];
      else if (ref) p = todas.find(x => x.tipo === ref.tipo && x.numero === ref.numero);
      if (p) { cerrarHoja(); abrir(p.id, null, colId); }
      else noExiste(cont);
    };
  }
  const noExiste = cont => {
    const i = cont.querySelector('#irA');
    i.setCustomValidity('No existe esa pieza'); i.reportValidity();
    setTimeout(() => i.isConnected && i.setCustomValidity(''), 1500);
  };

  $('cerrarLector').onclick = cerrar;
  $('lecAnterior').onclick = () => prev && abrir(prev.id, null, colActual);
  $('lecSiguiente').onclick = () => next && abrir(next.id, null, colActual);
  $('lecIndice').onclick = () => abrirIndice(colActual);
  $('lectorTexto').addEventListener('click', ev => {
    const a = ev.target.closest('a.enlace');
    if (!a) return;
    ev.preventDefault();
    cerrar();
    ctx.alEnlace(a);
  });

  return { abrir, cerrar, abrirIndice, get actual() { return actual; }, get coleccion() { return colActual; } };
}

/* Intervalos a resaltar en cada párrafo (k → [[a,b],…]) a partir del pasaje hallado. */
function mapaDeResaltes(p, pasaje, A) {
  const m = new Map();
  if (!pasaje || !pasaje.intervalos?.length) return m;
  const { parrafoIni: ini, parrafoFin: fin, intervalos } = pasaje;
  if (ini === fin) {
    const d = pasaje.desde || 0;
    m.set(ini, intervalos.map(([a, b]) => [a + d, b + d]));
    return m;
  }
  // Pasaje de varios párrafos (fragmento): se unió con '\n' sin las marcas.
  let off = 0;
  for (let k = ini; k <= fin; k++) {
    const t = p.parrafos[k];
    if (!t || A.esMarca(t)) continue;
    const a0 = off, b0 = off + t.length;
    const aqui = intervalos.filter(([a, b]) => b > a0 && a < b0).map(([a, b]) => [Math.max(a, a0) - a0, Math.min(b, b0) - a0]);
    if (aqui.length) m.set(k, aqui);
    off = b0 + 1;
  }
  return m;
}
