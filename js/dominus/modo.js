/* ============================================================
   Dominus nostrum — el modo (según prototipo/dominus/ y docs/DOMINUS.md).
   - Interruptor: /Dominus nostrum (o el atajo ✦) lo enciende o lo apaga.
   - Temporizador: 5 min por activación; /extender(n) suma hasta 10 min
     en total (máximo 15 min). Reloj real (Date.now()).
   - Con el modo encendido, lo que se escribe en la consola es una
     pregunta para Dominus nostrum, no una búsqueda.
   - Se apaga con el comando, con el tiempo (esperando a que termine
     una consulta en curso), al apagar al asistente, al cambiar de
     asistente o al volver al menú. Al apagarse se borra TODO.
   - La conversación vive solo en memoria (conversacion.js) y en esta
     versión no sale nada del dispositivo: los cerebros disponibles no
     usan la red (cerebros/).
   ============================================================ */
import { crearConversacion } from './conversacion.js';
import { crearEfectos, temaEfectos } from './efectos.js';
import { CEREBROS, CEREBRO_POR_DEFECTO, cargarCerebro } from './cerebros/index.js';

/* Tolerantes a lo que haga el teclado del celular (se comparan sin acentos) */
export const RE_COMANDO = /^\s*[\/\\]?\s*domin[ue]s?\s*(?:nost(?:rum|er|ro|ri)|nuestro)\b[\s,:;.\-–—]*/i;
/* /extender(5) — también «/extender 5», «/Extender( 5 )», «/extender(5 min)»; la «/» es obligatoria */
export const RE_EXTENDER = /^\s*[\/\\]\s*extender\b\s*\(?\s*([^)]*?)\s*\)?\s*$/i;
export const sinAcentos = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const esComando = q => RE_COMANDO.test(sinAcentos(q));
export const esExtender = q => RE_EXTENDER.test(sinAcentos(q));

export const DURACION_MIN = 5, MAX_EXTENSION_MIN = 10;
export const CLAVE_CEREBRO = 'anesthios.dominus.cerebro';
const MIN = 60000;

const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const esperar = ms => new Promise(ok => setTimeout(ok, ms));

const ERRORES = {
  'no-conectado': 'Dominus nostrum todavía no tiene un cerebro conectado. No se envió nada.',
  limite: 'Se alcanzó el límite gratuito de hoy. La búsqueda local sigue funcionando.',
  red: 'Sin internet: no pude consultar. La búsqueda local sigue funcionando.',
  rechazo: 'No pude consultar. Intenta de nuevo más tarde.',
  otro: 'No pude consultar. Intenta de nuevo más tarde.',
};

/**
 * ctx: {
 *   zona, stage, meta,
 *   asistente() → {S, tema, capa, cont, col, ventanas}   asistente activo (o null)
 *   escena()    → escena del asistente activo
 *   modo()      → estado del asistente ('apagado', 'activo', 'buscando', …)
 *   poner(m, texto), pista(texto, clase, ms)
 *   buscar(q)   → Promise: búsqueda local normal (sin guardarla en «recientes»)
 *   lector      → { abrir(id, pasaje, col), abrirTexto(titulo, html, tema), cerrarTexto() }
 *   leerAjuste(clave)
 * }
 */
export function crearModo(ctx) {
  const { zona, stage, meta } = ctx;
  const $ = id => document.getElementById(id);
  const nombre = () => { const a = ctx.asistente(); return a ? (a.col.asistente || a.col.nombre) : 'el asistente'; };

  /* Los cerebros se cargan al arrancar la app: durante una consulta no se
     pide NADA (ni siquiera un archivo de la propia app). */
  const cerebros = {};
  for (const [id, cargar] of Object.entries(CEREBROS)) cargar().then(m => { cerebros[id] = m.default; }).catch(e => console.warn('Dominus: cerebro', id, e));
  async function cerebroElegido() {
    const id = ctx.leerAjuste(CLAVE_CEREBRO) || CEREBRO_POR_DEFECTO;
    return cerebros[id] || (cerebros[id] = await cargarCerebro(id));
  }

  const efectos = crearEfectos({ zona, stage });
  const conv = crearConversacion({
    zona,
    tema: () => ctx.asistente()?.tema || 'agios',
    mover: t => ctx.asistente()?.ventanas.mover(t),
    alCitar: f => { if (!ctx.lector.abrir(f.pieza, f.pasaje, f.col)) ctx.pista('Ese fragmento ya no está en tu documento.', 'err', 5000); },
    alVerContexto: (titulo, html) => ctx.lector.abrirTexto(titulo, html, ctx.asistente()?.tema || 'agios'),
  });

  /* ---------------- estado (solo en memoria) ---------------- */
  let on = false, fin = 0, extendido = 0, aviso30 = false;
  let consulta = null;            // AbortController de la consulta en curso
  let ocupado = false;            // buscando primero o con el panel abierto
  let ronda = 0;                  // invalida los pasos pendientes al apagarse

  const restante = () => fin - Date.now();
  const destellar = (hex, k = 1, h = 900) => {
    const S = ctx.asistente()?.S; if (!S) return;
    S.destello.color.set(hex); S.destello.k = Math.max(S.destello.k, k); S.destello.h = h;
    if (hex !== tinte()) efectos.respetarDestello(h + 900);       // que el rojo se vea entero
  };
  const tinte = () => temaEfectos(ctx.asistente()?.tema).tinte;
  const ventanas = () => ctx.asistente()?.ventanas.lista() || [];
  const fondos = () => [...document.querySelectorAll('.decor .reticula, .decor .esfera')];

  /* ---------------- atajos en la barra de sugerencias ---------------- */
  const sug = $('sugDominus'), sugExt = $('sugExtender');
  sug.onclick = () => manejar('/Dominus nostrum');
  sugExt.onclick = () => manejar(sugExt.dataset.q);

  /** Chip, placeholder y atajos según el momento */
  function marcar() {
    const quedaExt = MAX_EXTENSION_MIN - extendido, paso = Math.min(5, quedaExt);
    sugExt.hidden = !(on && quedaExt > 0);
    if (sugExt.dataset.q !== `/extender(${paso})`) { sugExt.dataset.q = `/extender(${paso})`; sugExt.textContent = `⏱ /extender(${paso})`; }
    sug.classList.toggle('dm-on', on);
    const e = etiqueta(ctx.modo());
    if (!on) return;
    $('chip').classList.add('dm');
    if (e && $('estado').textContent !== e) $('estado').textContent = e;
    const p = placeholder(ctx.modo());
    if (p != null && $('consulta').placeholder !== p) $('consulta').placeholder = p;
  }
  /** Texto del chip mientras el asistente está libre: «Dominus nostrum · m:ss» (null: el de siempre).
      El reloj va en su propio elemento para que siempre se vea completo en el celular. */
  function etiqueta(m) {
    const reloj = $('dmReloj'), ver = on && m === 'activo';
    if (reloj.hidden === ver) reloj.hidden = !ver;
    if (!ver) return null;
    const t = mmss(restante());
    if (reloj.textContent !== t) reloj.textContent = t;
    return 'Dominus nostrum ·';
  }
  function placeholder(m) {
    if (!on || m !== 'activo') return null;
    return conv.hayContexto ? 'Continúa la conversación…' : 'Pregúntale a Dominus nostrum sobre lo encontrado…';
  }

  /* ---------------- encender y apagar ---------------- */
  function encender() {
    on = true; fin = Date.now() + DURACION_MIN * MIN; extendido = 0; aviso30 = false; ronda++;
    efectos.meta = 0.5; efectos.fase = 'abierto';
    destellar(tinte(), 1, 500);                              // destello platino al despertar
    $('consulta').value = '';
    ctx.poner('activo');
    ctx.pista(`Dominus nostrum activado · ${DURACION_MIN} min. Escribe el comando otra vez para apagarlo`, 'dm', 4500);
    marcar();
    setTimeout(() => { if (on && !$('consulta').disabled) $('consulta').focus(); }, 50);
  }
  /**
   * motivo: 'comando' | 'tiempo' | 'apagado' | 'cambio' | 'menu'
   * Se borra todo: conversación, fragmentos, números [n], contexto en el lector.
   */
  function apagar(motivo) {
    if (!on) return;
    const minutos = DURACION_MIN + extendido;
    on = false; ronda++; ocupado = false; extendido = 0; fin = 0; aviso30 = false;
    consulta?.abort(); consulta = null;                      // la respuesta, si llega, se descarta
    conv.borrar();
    ctx.lector.cerrarTexto();
    const a = ctx.asistente();
    a?.cont.classList.remove('dm-replegado');
    if (motivo === 'cambio' || motivo === 'menu' || motivo === 'apagado') efectos.reiniciar(a?.S);   // de inmediato, antes de la transición
    else { efectos.meta = 0; efectos.fase = 'nada'; }
    meta.temblor = 0;
    $('chip').classList.remove('dm');
    $('consulta').value = '';
    marcar();
    const m = ctx.modo();
    if (m === 'activo' || m === 'dominus') ctx.poner('activo');   // devuelve la velocidad normal
    if (motivo === 'comando') ctx.pista('Dominus nostrum desactivado · conversación borrada', 'dm', 4500);
    else if (motivo === 'tiempo') ctx.pista(`Dominus nostrum se desactivó (pasaron ${minutos} minutos) · conversación borrada`, 'dm', 6000);
  }

  /* ---------------- /extender(n) ---------------- */
  function extender(txt) {
    if (!on) return ctx.pista('Dominus nostrum no está activo. Actívalo primero con /Dominus nostrum', 'err', 5000);
    const n = parseInt(String(txt || '').replace(/[^\d]/g, ''), 10);
    if (!n || n < 1) return ctx.pista('Escribe los minutos entre paréntesis, por ejemplo /extender(5)', 'err', 5000);
    const disponible = MAX_EXTENSION_MIN - extendido;
    if (disponible <= 0) return ctx.pista(`Ya usaste los ${MAX_EXTENSION_MIN} min de extensión de esta activación`, 'err', 5000);
    const suma = Math.min(disponible, n);
    extendido += suma; fin += suma * MIN; aviso30 = false;  // el aviso de 30 s puede volver a salir
    const resto = mmss(restante()), quedaExt = MAX_EXTENSION_MIN - extendido;
    ctx.pista((n > suma ? `Solo quedaban ${suma} min de extensión. ` : '') + `+${suma} min · quedan ${resto}` +
      (quedaExt ? ` · puedes extender ${quedaExt} min más` : ' · ya no se puede extender más'), 'dm', 5000);
    if (conv.hayContexto) conv.aviso(`Tiempo extendido ${suma} min · quedan ${resto}.`);
    destellar(tinte(), 0.8, 300);                            // pequeño destello platino
    marcar();
  }

  /* ---------------- la consola: true si Dominus se encargó ---------------- */
  function manejar(texto) {
    const q = (texto || '').trim();
    if (!q) return false;
    const ext = sinAcentos(q).match(RE_EXTENDER);
    const cmd = !ext && esComando(q);
    if ((ext || cmd) && ctx.modo() === 'apagado') { ctx.pista(`Primero toca a ${nombre()} para encenderlo`, 'err', 5000); return true; }
    if (ext) { extender(ext[1]); $('consulta').value = ''; return true; }     // nunca se envía al cerebro
    if (cmd) {
      $('consulta').value = '';
      if (on) { apagar('comando'); return true; }
      if (ctx.modo() !== 'activo') { ctx.pista(`Espera a que ${nombre()} termine`, 'err', 4000); return true; }
      encender();
      const resto = q.slice((sinAcentos(q).match(RE_COMANDO) || [''])[0].length).trim();
      if (resto) preguntar(resto);
      return true;
    }
    if (on) { preguntar(q); return true; }
    return false;
  }

  /* ---------------- preguntar: fragmentos, confirmación y consulta ---------------- */
  async function preguntar(pregunta) {
    $('consulta').value = '';
    if (ctx.modo() !== 'activo' || ocupado || consulta) return ctx.pista(`Espera a que ${nombre()} termine`, 'err', 4000);
    const r = ronda;
    let nuevas = conv.noEnviadas(ventanas());
    if (!nuevas.length && conv.fragmentos.length) return consultar(pregunta, []);   // seguimos con el mismo contexto
    if (!nuevas.length) {
      /* Primera pregunta sin ventanas abiertas: primero la búsqueda local normal */
      ocupado = true;
      try {
        await ctx.buscar(pregunta);
        for (let i = 0; i < 50 && r === ronda; i++) {                              // espera a que nazcan sus ventanas
          const v = ventanas();
          if (v.length && v.every(({ t }) => t.classList.contains('visible'))) break;
          await esperar(100);
        }
        await esperar(600);
      } finally { if (r === ronda) ocupado = false; }
      if (r !== ronda || !on) return;
      $('consulta').value = '';
      nuevas = conv.noEnviadas(ventanas());
      if (!nuevas.length) { ctx.pista('No encontré fragmentos para esa pregunta. Busca con otras palabras.', 'err', 6000); marcar(); return; }
    }
    if (ctx.modo() !== 'activo') return;
    const cerebro = await cerebroElegido();
    if (r !== ronda) return;
    ocupado = true;
    ctx.poner('dominus', 'Dominus nostrum · preparando');
    efectos.meta = 0.5; efectos.fase = 'abierto';
    const elegidos = await conv.confirmar(pregunta, nuevas, cerebro);
    if (r !== ronda) return;
    ocupado = false;
    if (!elegidos) { ctx.poner('activo'); marcar(); return; }                     // cancelado: no se envía nada
    consultar(pregunta, elegidos, cerebro);
  }

  async function consultar(pregunta, nuevos, cerebro = null) {
    const r = ronda, a = ctx.asistente();
    cerebro ??= await cerebroElegido();
    if (r !== ronda) return;
    conv.usarCerebro(cerebro);
    conv.abrirVentana(a.cont);
    conv.pregunta(pregunta);
    const escribiendo = conv.escribiendo();
    ctx.poner('dominus', 'Dominus nostrum · consultando afuera');
    meta.temblor = 0.25;
    efectos.meta = 1; efectos.fase = 'pensando';
    const ac = new AbortController(); consulta = ac;
    let error = null, respuesta = null;
    try {
      respuesta = await cerebro.responder({ ...conv.contexto(), senal: ac.signal });
    } catch (e) { error = e; }
    if (consulta === ac) consulta = null;
    if (ac.signal.aborted || r !== ronda || !on) return;      // se apagó mientras consultaba: se descarta
    escribiendo?.remove();
    efectos.meta = 0.5; efectos.fase = 'abierto';
    if (error || typeof respuesta?.texto !== 'string') {
      conv.quitarUltimaPregunta();                            // esa pregunta no queda en el contexto
      const tipo = ERRORES[error?.tipo] ? error.tipo : 'otro';
      if (tipo !== 'no-conectado') console.warn('Dominus nostrum:', error);
      (tipo === 'no-conectado' ? conv.aviso : conv.error)(ERRORES[tipo]);
      destellar('#ff4d5e');
      ctx.poner('activo', 'no se pudo consultar');
    } else {
      conv.respuesta(respuesta.texto);
      destellar(tinte());
      ctx.poner('activo', 'respuesta lista');
    }
    marcar();
    if (restante() <= 0) apagar('tiempo');                    // el tiempo se cumplió durante la consulta
  }

  /* ---------------- reloj: cuenta regresiva, últimos 30 s, vencimiento ---------------- */
  function revisar() {
    if (!on) return marcar();
    const m = ctx.modo();
    if (m === 'apagado') return apagar('apagado');
    const r = restante();
    if (r <= 0 && !consulta && m !== 'buscando' && !(ocupado && !conv.panelAbierto)) return apagar('tiempo');
    if (!aviso30 && r < 30000 && conv.hayContexto) {
      aviso30 = true; conv.aviso('Quedan 30 segundos. Al apagarse el modo, esta conversación se borra.');
    }
    if (efectos.fase === 'abierto') efectos.meta = r < 30000 ? 0.3 + 0.25 * (Math.sin(Date.now() / 180) > 0) : 0.5;   // late para avisar
    const a = ctx.asistente();
    if (a) conv.numerar(ventanas());
    marcar();
  }
  setInterval(revisar, 250);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar(); });

  /* ---------------- cada cuadro (lo llama el bucle de la app) ---------------- */
  function cuadro(t, dT) {
    const a = ctx.asistente();
    if (on) {
      const m = ctx.modo();
      if (m === 'activo' || m === 'dominus' || m === 'buscando') meta.mult = 3;   // velocidad x3
    }
    if (!a) return;
    const chat = on ? conv.ventanaAbierta() : null;
    a.cont.classList.toggle('dm-replegado', on && (!!chat || efectos.fase === 'pensando'));   // las ventanas de fragmentos se repliegan
    if (!on && efectos.intensidad === 0 && efectos.encogido.k === 1) { a.S.caos = 0; return; }
    efectos.cuadro(t, dT, { a, escena: ctx.escena(), chat, fondos: fondos() });
  }

  return {
    manejar, apagar, cuadro, etiqueta, placeholder,
    get encendido() { return on; },
    /** «Cerrar todas»: también cierra la ventana de conversación (la conversación sigue) */
    cerrarConversacion() { conv.cerrarVentana(); },
    /** Solo para diagnóstico y pruebas: cifras, nunca el texto de la conversación */
    get estado() {
      return {
        encendido: on, restanteMs: on ? restante() : 0, extendido, consultando: !!consulta, panel: conv.panelAbierto,
        fragmentos: conv.fragmentos.length, mensajes: conv.mensajes.length, ventana: !!conv.ventana,
        intensidad: efectos.intensidad, fase: efectos.fase, encogido: efectos.encogido, rayos: efectos.rayos, chispas: efectos.chispas,
        msEfectos: efectos.ms, dprLienzo: efectos.dpr,
        centroRayos: (() => { const a = ctx.asistente(); return a && ctx.escena() ? efectos.centro(ctx.escena(), a.S) : null; })(),
      };
    },
  };
}
