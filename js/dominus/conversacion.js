/* ============================================================
   Dominus nostrum — la conversación (SOLO en memoria).
   - Contexto: fragmentos numerados [n] y mensajes, en variables de
     JavaScript. Nunca en localStorage, sessionStorage, IndexedDB,
     caché ni service worker. Al apagarse el modo se borra todo.
   - Panel de confirmación: la pregunta y los fragmentos NUEVOS (con
     casilla para quitarlos), cuántos fragmentos y palabras se
     enviarían y qué cerebro está elegido.
   - Ventana de conversación: burbujas, citas [n] que abren el
     fragmento en el lector, minimizar, arrastrar, «Qué se ha enviado».
   Fragmento = el pasaje que muestra una ventana de resultado (sin
   HTML), nunca la pieza completa ni el documento.
   ============================================================ */
import { escaparHtml as esc } from '../texto.js';
import { INSTRUCCION } from './instruccion.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const contarPalabras = s => (s.match(/\S+/g) || []).length;
const minuscula = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;

/**
 * ctx: {
 *   zona,
 *   tema() → 'agios' | 'kyrien'          tema del asistente activo
 *   mover(ventana)                       la hace arrastrable (como las demás ventanas)
 *   alCitar(fragmento)                   abrir ese fragmento en el lector
 *   alVerContexto(titulo, html)          abrir «Qué se ha enviado» en el lector
 * }
 */
export function crearConversacion(ctx) {
  const { zona } = ctx;
  let conv = null;                 // { frags:[{n,pieza,col,ref,tipo,texto,pasaje}], msgs:[{rol,texto}], vista:[], ventana, movida }
  let previa = new Map();          // pieza → n mientras el panel está abierto
  let alResolverPanel = null;

  const nueva = () => ({ frags: [], msgs: [], vista: [], ventana: null, movida: false, cerebro: null });
  const asegurar = () => (conv ??= nueva());

  /* ---------------- números [n] en las ventanas de resultado ---------------- */
  /** Sincroniza los números [n] pintados en las ventanas abiertas (lista: [{t, r}]) */
  function numerar(lista) {
    const enviadas = new Map((conv?.frags || []).map(f => [f.pieza, f.n]));
    for (const { t, r } of lista) {
      const n = enviadas.get(r.pieza) ?? previa.get(r.pieza);
      let b = t.querySelector('.dm-num');
      if (n == null) { b?.remove(); continue; }
      if (!b) { b = document.createElement('span'); b.className = 'dm-num'; t.querySelector('.ref')?.before(b); }
      if (b.textContent !== String(n)) b.textContent = n;
    }
  }
  const quitarNumeros = () => document.querySelectorAll('.dm-num').forEach(b => b.remove());

  /** Ventanas cuyo fragmento todavía no se ha enviado en esta conversación */
  function noEnviadas(lista) {
    const ya = new Set((conv?.frags || []).map(f => f.pieza));
    return lista.filter(({ r }) => !ya.has(r.pieza));
  }

  /* ---------------- panel de confirmación ---------------- */
  const panel = document.createElement('div');
  panel.className = 'dm-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Dominus nostrum: confirmar consulta');
  zona.append(panel);

  /**
   * Muestra la pregunta y los fragmentos nuevos. Resuelve con los
   * fragmentos elegidos ([{n,…}], con su número definitivo) o null si
   * se cancela o se cierra.
   */
  function confirmar(pregunta, lista, cerebro) {
    asegurar();
    cerrarPanel();
    const previos = conv.frags.length;
    let sig = conv.frags.reduce((m, f) => Math.max(m, f.n), 0);
    const items = lista.map(({ t, r }) => ({
      t, n: ++sig, pieza: r.pieza, col: r.col, ref: r.ref, tipo: r.tipo, texto: r.extracto?.texto || '', pasaje: r.pasaje || null, off: false,
    }));
    previa = new Map(items.map(f => [f.pieza, f.n]));
    numerar(lista);
    const sub = previos ? 'Fragmentos <b>nuevos</b> que se agregarían a la conversación'
      : cerebro.envia ? 'Consulta externa · esto es <b>todo</b> lo que saldrá del dispositivo'
        : 'Esto es <b>todo</b> lo que recibiría Dominus nostrum';
    panel.innerHTML = `<h4>DOMINUS NOSTRUM</h4><p class="dm-sub">${sub}</p>` +
      `<div class="dm-preg"><b>Tu pregunta:</b> ${esc(pregunta)}</div>` +
      items.map((f, i) => `<label class="dm-frag" data-i="${i}"><input type="checkbox" checked><span class="dm-n">${f.n}</span>` +
        `<span><b>${esc(f.ref)}</b> · ${esc(f.tipo)}<span class="dm-prev">${esc(f.texto)}</span></span></label>`).join('') +
      `<div class="dm-nota"></div>` +
      `<div class="dm-botones"><button type="button" class="dm-cancelar">Cancelar</button><button type="button" class="dm-prim dm-consultar">✦ Consultar</button></div>`;
    const nota = () => {
      const elegidos = items.filter(f => !f.off), n = elegidos.length;
      const palabras = elegidos.reduce((s, f) => s + contarPalabras(f.texto), 0) + contarPalabras(pregunta);
      panel.querySelector('.dm-nota').innerHTML =
        (previos ? `Ya tiene ${plural(previos, 'fragmento', 'fragmentos')} de esta conversación. Se ${n === 1 ? 'agregaría' : 'agregarían'} <b>${n}</b> más`
          : `Se enviarían tu pregunta y <b>${n}</b> ${n === 1 ? 'fragmento' : 'fragmentos'}`) +
        ` (≈ ${palabras} palabras). El documento completo no sale. Responderá <b>solo con lo que digan los fragmentos</b>, citando [n].` +
        `<br>Cerebro: ${esc(minuscula(cerebro.nombre))} — ${esc(minuscula(cerebro.aviso))}`;
      panel.querySelector('.dm-consultar').disabled = n === 0 && !previos;
    };
    panel.querySelectorAll('.dm-frag').forEach(l => {
      l.querySelector('input').onchange = ev => {
        const f = items[l.dataset.i]; f.off = !ev.target.checked; l.classList.toggle('off', f.off);
        if (f.off) previa.delete(f.pieza); else previa.set(f.pieza, f.n);
        numerar(lista); nota();
      };
    });
    nota();
    return new Promise(ok => {
      alResolverPanel = ok;
      panel.querySelector('.dm-cancelar').onclick = () => cerrarPanel();
      panel.querySelector('.dm-consultar').onclick = () => {
        // números definitivos: los elegidos, seguidos a partir del último
        let n = conv.frags.reduce((m, f) => Math.max(m, f.n), 0);
        const elegidos = items.filter(f => !f.off).map(({ t, off, ...f }) => ({ ...f, n: ++n }));
        cerrarPanel(elegidos);
        numerar(lista);
      };
      requestAnimationFrame(() => panel.classList.add('ver'));
    });
  }
  /** Cierra el panel; sin `resultado` cuenta como cancelado (se quitan los números puestos) */
  function cerrarPanel(resultado = null) {
    panel.classList.remove('ver');
    const f = alResolverPanel; alResolverPanel = null;
    if (resultado) conv.frags.push(...resultado);
    previa = new Map();
    if (f) {
      document.querySelectorAll('.tarjeta .dm-num').forEach(b => {
        const t = b.closest('.tarjeta');
        if (!(conv?.frags || []).some(x => x.pieza === t.dataset.pieza)) b.remove();
      });
      f(resultado);
    }
  }

  /* ---------------- ventana de conversación ---------------- */
  function acomodar() {
    const t = conv?.ventana;
    if (!t || !t.isConnected) return;
    const W = zona.clientWidth, H = zona.clientHeight;
    t.style.width = Math.min(W * 0.92, 400) + 'px';
    if (!conv.movida) {
      t.style.left = Math.max(6, (W - t.offsetWidth) / 2) + 'px';
      t.style.top = Math.max(90, H - t.offsetHeight - 10) + 'px';
    } else {
      t.style.left = Math.max(-t.offsetWidth + 60, Math.min(W - 60, t.offsetLeft)) + 'px';
      t.style.top = Math.max(0, Math.min(H - 40, t.offsetTop)) + 'px';
    }
  }
  new ResizeObserver(acomodar).observe(zona);

  function pie() {
    const v = conv?.ventana;
    if (v) v.querySelector('.dm-ctx').textContent = `${plural(conv.frags.length, 'fragmento', 'fragmentos')} · ${plural(conv.msgs.length, 'mensaje', 'mensajes')}`;
  }

  /** Abre la ventana (o la vuelve a abrir con los mismos mensajes si «Cerrar todas» la cerró) */
  function abrirVentana(cont) {
    asegurar();
    if (conv.ventana?.isConnected && !conv.ventana.classList.contains('cerrando')) { conv.ventana.classList.remove('dm-min'); acomodar(); return; }
    const t = document.createElement('div');
    t.className = `tarjeta t-${ctx.tema()} dm-resp dm-chat`;
    t.style.zIndex = 500;
    t.innerHTML = `<div class="cab"><span class="agarre">⋮⋮</span><span class="ref">✦ Dominus nostrum</span><span class="tipo">conversación</span>` +
      `<button class="dm-mini x" type="button" title="Minimizar" aria-label="Minimizar">–</button></div>` +
      `<div class="dm-msgs" role="log" aria-live="polite"></div>` +
      `<div class="dm-pie"><span class="dm-ctx"></span><button type="button" class="dm-enviado">Qué se ha enviado</button></div>`;
    t.querySelector('.dm-mini').onclick = () => { t.classList.toggle('dm-min'); acomodar(); };
    t.querySelector('.dm-enviado').onclick = () => ctx.alVerContexto('Contexto de esta conversación', htmlContexto());
    t.querySelector('.dm-msgs').addEventListener('click', ev => {
      const b = ev.target.closest('.dm-cita');
      const f = b && conv?.frags.find(x => String(x.n) === b.dataset.n);
      if (f) ctx.alCitar(f);
    });
    cont.append(t);
    conv.ventana = t; conv.movida = false;
    ctx.mover(t);
    t.querySelector('.cab').addEventListener('pointermove', ev => { if (ev.buttons && conv) conv.movida = true; });
    const vista = conv.vista; conv.vista = [];
    vista.forEach(([clase, html]) => pintar(clase, html));
    acomodar(); pie();
    t.animate([{ transform: 'scale(.05)', opacity: 0, filter: 'brightness(3)' }, { transform: 'scale(1.03)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1, filter: 'none' }],
      { duration: 650, easing: 'cubic-bezier(.2,.9,.3,1)' });
    t.classList.add('visible');
  }
  /** «Cerrar todas»: la ventana se cierra pero la conversación sigue (vuelve con la siguiente pregunta) */
  function cerrarVentana() {
    const v = conv?.ventana;
    if (!v) return;
    conv.ventana = null;
    v.classList.add('cerrando'); setTimeout(() => v.remove(), 300);
  }
  const ventanaAbierta = () => {
    const v = conv?.ventana;
    return v && v.isConnected && !v.classList.contains('dm-min') && !v.classList.contains('cerrando') ? v : null;
  };

  function pintar(clase, html, { guardar = true } = {}) {
    if (guardar) asegurar().vista.push([clase, html]);
    const caja = conv?.ventana?.querySelector('.dm-msgs');
    if (!caja) return null;
    const m = document.createElement('div');
    m.className = 'dm-msg ' + clase; m.innerHTML = html;
    caja.append(m);
    caja.scrollTop = caja.scrollHeight;
    pie(); acomodar();
    return m;
  }
  const conCitas = texto => {
    const validas = new Set((conv?.frags || []).map(f => String(f.n)));
    return esc(texto).replace(/\[(\d+)\]/g, (m, n) => validas.has(n) ? `<button type="button" class="dm-cita" data-n="${n}" aria-label="Fragmento ${n}">${n}</button>` : m)
      .replace(/\n/g, '<br>');
  };

  function htmlContexto() {
    const c = conv || nueva();
    return `<h2>Contexto de esta conversación</h2>` +
      `<p class="dm-ctx-instr"><b>Instrucción fija</b><br><i>${esc(INSTRUCCION)}</i></p>` +
      (c.frags.length ? c.frags.map(f => `<p><b>[${f.n}] ${esc(f.ref)} · ${esc(f.tipo)}</b><br>${esc(f.texto)}</p>`).join('') : '<p><i>Sin fragmentos todavía.</i></p>') +
      c.msgs.map(m => `<p><b>${m.rol === 'usuario' ? 'Tú' : 'Dominus nostrum'}:</b> ${esc(m.texto)}</p>`).join('') +
      (c.cerebro ? `<p><i>Cerebro: ${esc(minuscula(c.cerebro.nombre))} — ${esc(minuscula(c.cerebro.aviso))}</i></p>` : '') +
      `<p><i>Todo esto vive solo en la memoria de la app y se borra al apagar el modo.</i></p>`;
  }

  return {
    get activa() { return !!conv; },
    get fragmentos() { return conv?.frags || []; },
    get mensajes() { return conv?.msgs || []; },
    get hayContexto() { return !!(conv && (conv.frags.length || conv.msgs.length)); },
    get panelAbierto() { return !!alResolverPanel; },
    get ventana() { return conv?.ventana || null; },
    numerar, noEnviadas, confirmar, cerrarPanel, abrirVentana, cerrarVentana, ventanaAbierta, acomodar,
    usarCerebro(c) { asegurar().cerebro = c; },
    pregunta(texto) { asegurar().msgs.push({ rol: 'usuario', texto }); pintar('yo', esc(texto)); pie(); },
    /** La consulta falló: esa pregunta no queda en el contexto */
    quitarUltimaPregunta() { const i = conv?.msgs.map(m => m.rol).lastIndexOf('usuario'); if (i >= 0) conv.msgs.splice(i, 1); pie(); },
    respuesta(texto) { asegurar().msgs.push({ rol: 'dominus', texto }); pintar('dom', conCitas(texto)); pie(); },
    escribiendo() { return pintar('dom', '<span class="dm-pensando" aria-label="Dominus nostrum está escribiendo"><i></i><i></i><i></i></span>', { guardar: false }); },
    error(texto) { pintar('err', esc(texto)); },
    aviso(texto) { pintar('aviso', esc(texto)); },
    /** Copia del contexto para el cerebro (nunca referencias internas) */
    contexto() {
      return {
        instruccion: INSTRUCCION,
        fragmentos: (conv?.frags || []).map(({ n, ref, tipo, texto }) => ({ n, ref, tipo, texto })),
        mensajes: (conv?.msgs || []).map(({ rol, texto }) => ({ rol, texto })),
      };
    },
    /** Apagar el modo: se borra TODO, como si nunca se hubiera encendido */
    borrar() {
      cerrarPanel();
      if (conv?.ventana) { const v = conv.ventana; v.classList.add('cerrando'); setTimeout(() => v.remove(), 300); }
      quitarNumeros();
      if (conv) { conv.frags.length = 0; conv.msgs.length = 0; conv.vista.length = 0; }
      conv = null;
      panel.innerHTML = '';
    },
  };
}
