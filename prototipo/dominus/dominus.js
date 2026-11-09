/* ============================================================
   Modo «Dominus nostrum» — segundo cerebro externo (PROTOTIPO)
   Se monta encima de un prototipo de asistente (Agios o Kyrien)
   sin tocar su escena: solo usa su contrato (S, proyectar).

   Reglas:
   - Solo se activa con el comando  /Dominus nostrum <pregunta>
     (tolerante: mayúsculas, acentos, «noster», «nostro»).
   - Solo recibe la pregunta y los fragmentos que encontró la
     búsqueda local (las ventanas abiertas). Nunca el documento.
   - Antes de enviar, muestra exactamente qué se va a mandar.
   - Responde solo con base en esos fragmentos y cita [n].
   - Mientras consulta afuera, el asistente cambia de estado:
     más brillo, tinte propio y rayos de energía alrededor.
   (Aquí la respuesta es SIMULADA; no se conecta a nada.)
   ============================================================ */
import * as THREE from 'three';

/* Tolerante a lo que haga el teclado: acentos, mayúsculas, espacios, sin «/» */
export const RE_COMANDO = /^\s*[\/\\]?\s*domin[ue]s?\s*(?:nost(?:rum|er|ro|ri)|nuestro)\b[\s,:;.\-–—]*/i;
const sinAcentos = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const esComando = q => RE_COMANDO.test(sinAcentos(q || ''));
/* /extender(5) — también acepta «/extender 5», «/extender( 5 min )» */
const RE_EXTENDER = /^\s*[\/\\]\s*extender\b\s*\(?\s*([^)]*?)\s*\)?\s*$/i;
const MAX_EXTENSION = 10;

const TEMAS = {
  agios: {
    nombre: 'Agios', tinte: '#dbe6f7', tinteK: .78, estilo: 'electrico',      // platino azulado
    rayo: ['#ffffff', '#e4edff', '#bcd2f5'], brillo: 'rgba(160,190,240,', aura: 'rgba(205,220,245,',
    css: `
      .dm-panel{background:rgba(10,10,32,.94);border:1px solid #7a6ff0;color:#d9d6ff;font:13px 'JetBrains Mono',monospace;
        box-shadow:0 0 0 1px rgba(122,111,240,.25),0 0 40px rgba(110,170,255,.35)}
      .dm-panel h4{font:600 15px Rajdhani,sans-serif;letter-spacing:.32em;color:#eef3ff}
      .dm-panel .dm-sub{color:#8f8ad0}
      .dm-panel .dm-frag{border:1px solid #2c2766;background:rgba(122,111,240,.07)}
      .dm-panel .dm-frag.off{opacity:.4}
      .dm-panel .dm-n{background:#e9f3ff;color:#120f38}
      .dm-panel .dm-nota{color:#8f8ad0;border-top:1px dashed #2c2766}
      .dm-panel button{color:#e4e1ff;border:1px solid #534AB7;background:transparent}
      .dm-panel button.dm-prim{background:linear-gradient(180deg,#3a5bd0,#5b3fc4);border-color:#bfe4ff;color:#fff;box-shadow:0 0 14px rgba(150,200,255,.5)}
      .tarjeta.dm-resp{border-color:#bfe4ff;box-shadow:0 0 0 1px rgba(191,228,255,.35),0 0 36px rgba(150,200,255,.45)}
      .tarjeta.dm-resp .cab{background:linear-gradient(90deg,rgba(150,200,255,.18),rgba(180,150,255,.12))}
      .tarjeta.dm-resp .ref{color:#fff;letter-spacing:.12em}
      .tarjeta.dm-resp p{font-size:14px;color:#e8ecff}
      .dm-cita{font:600 11px 'JetBrains Mono',monospace;color:#120f38;background:#bfe4ff;border-radius:3px;padding:0 4px;margin:0 1px;border:none;cursor:pointer}
      .dm-pie{font:10.5px 'JetBrains Mono',monospace;color:#8f8ad0}
      .tarjeta .dm-num{font:700 11px 'JetBrains Mono',monospace;color:#120f38;background:#e9f3ff;border-radius:3px;padding:0 5px}
      .chip-estado.dm{color:#eef6ff;border-color:#bfe4ff!important;box-shadow:0 0 14px rgba(150,200,255,.45)}
      .chip-estado.dm i{background:#fff!important;box-shadow:0 0 10px 3px rgba(190,225,255,.95)!important}
      .dm-msg{font:13.5px/1.45 system-ui,sans-serif}
      .dm-msg.yo{background:rgba(122,111,240,.22);color:#ecebff;border:1px solid rgba(122,111,240,.45)}
      .dm-msg.dom{background:rgba(219,230,247,.08);color:#e8ecff;border:1px solid rgba(191,212,245,.35)}
      .dm-enviado{font:500 11px 'JetBrains Mono',monospace;color:#e4e1ff;border:1px solid #534AB7;background:transparent;border-radius:6px;padding:5px 9px}`
  },
  kyrien: {
    nombre: 'Kyrien', tinte: '#dbe6f7', tinteK: .72, estilo: 'magia',        // platino azulado
    rayo: ['#f4f8ff', '#d3e1f8', '#b9cdf0'], chispa: ['#ffffff', '#e8f0ff', '#ffe6b0'], brillo: 'rgba(170,195,240,', aura: 'rgba(210,224,248,',
    css: `
      .dm-panel{background:linear-gradient(180deg,#f3e7c9,#e4d2ad);border:1px solid #9c7a3c;color:#3a2a18;font:500 16px 'Cormorant Garamond',serif;
        box-shadow:0 0 0 4px rgba(239,226,196,.25),0 0 46px rgba(255,190,90,.55)}
      .dm-panel h4{font:600 15px Cinzel,serif;letter-spacing:.24em;color:#5a3d16}
      .dm-panel .dm-sub{color:#6b5434;font-style:italic}
      .dm-panel .dm-frag{border:1px solid #c9a564;background:rgba(255,248,230,.5)}
      .dm-panel .dm-frag.off{opacity:.45}
      .dm-panel .dm-n{background:#5a3d16;color:#f3dca6}
      .dm-panel .dm-nota{color:#6b5434;border-top:1px dashed #c9a564;font-style:italic}
      .dm-panel button{color:#3a2408;border:1px solid #9c7a3c;background:transparent;font:600 15px 'Cormorant Garamond',serif}
      .dm-panel button.dm-prim{background:linear-gradient(180deg,#fff0c4,#e7b65a);border-color:#9c7a3c;box-shadow:0 0 16px rgba(255,190,90,.6)}
      .tarjeta.dm-resp{border-color:#fff0c4;box-shadow:0 0 0 3px rgba(255,240,196,.35),0 0 44px rgba(255,190,90,.6)}
      .tarjeta.dm-resp .cab{background:linear-gradient(180deg,#fff0c4,#e7b65a)}
      .dm-cita{font:700 13px Cinzel,serif;color:#f3dca6;background:#5a3d16;border-radius:3px;padding:0 5px;margin:0 1px;border:none;cursor:pointer}
      .dm-pie{font:italic 14px 'Cormorant Garamond',serif;color:#6b5434}
      .tarjeta .dm-num{font:700 12px Cinzel,serif;color:#f3dca6;background:#5a3d16;border-radius:3px;padding:0 5px}
      .chip-estado.dm{color:#fff6e0;border-color:#fff0c4!important;box-shadow:0 0 16px rgba(255,200,110,.55)}
      .chip-estado.dm i{background:#fff!important;box-shadow:0 0 10px 3px rgba(255,220,150,.95)!important}
      .dm-msg{font:500 16.5px/1.4 'Cormorant Garamond',serif}
      .dm-msg.yo{background:linear-gradient(180deg,#e7c27a,#d4a95c);color:#2e1d08;border:1px solid #9c7a3c}
      .dm-msg.dom{background:rgba(255,250,238,.6);color:#3a2a18;border:1px solid #c9a564}
      .tarjeta.dm-chat .dm-msg.err{color:#7a1020;background:rgba(255,200,200,.5)}
      .dm-enviado{font:600 14px 'Cormorant Garamond',serif;color:#3a2408;border:1px solid #9c7a3c;background:linear-gradient(180deg,#f3dca6,#dcbc7c);border-radius:6px;padding:4px 10px}`
  }
};

const CSS_BASE = `
  #dm-rayos{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}
  .dm-panel{position:absolute;left:50%;top:50%;width:min(90vw,380px);max-height:92%;overflow:auto;padding:16px 16px 14px;border-radius:6px;z-index:6;
    transform:translate(-50%,-50%) scale(.85);opacity:0;transition:transform .35s cubic-bezier(.2,.9,.3,1.2),opacity .25s;pointer-events:none}
  .dm-panel.ver{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto}
  .dm-panel h4{margin:0 0 4px;text-align:center}
  .dm-panel .dm-sub{text-align:center;margin:0 0 12px;line-height:1.35}
  .dm-panel .dm-preg{margin:0 0 10px;padding:8px 10px;border-radius:4px;background:rgba(127,127,127,.12);line-height:1.4}
  .dm-panel .dm-frag{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border-radius:4px;margin-bottom:6px;cursor:pointer;line-height:1.35}
  .dm-panel .dm-frag>span:last-child{min-width:0;flex:1}
  .dm-panel .dm-prev{display:block;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.9em}
  #resultados.dm-replegado .tarjeta:not(.dm-chat){opacity:0;transform:scale(.55);pointer-events:none;transition:transform .45s ease-in,opacity .4s}
  .dm-panel .dm-frag input{margin:3px 0 0;accent-color:currentColor}
  .dm-panel .dm-n{flex:none;border-radius:3px;padding:0 5px;font-weight:700}
  .dm-panel .dm-nota{margin:10px 0 12px;padding-top:9px;font-size:.88em;line-height:1.4}
  .dm-panel .dm-botones{display:flex;gap:8px}
  .dm-panel .dm-botones button{flex:1;border-radius:8px;padding:9px 10px}
  .tarjeta.dm-resp p{white-space:normal}
  .tarjeta.dm-chat{display:flex;flex-direction:column}
  .dm-msgs{max-height:min(30vh,260px);overflow-y:auto;padding:10px 10px 4px;display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain}
  .tarjeta.dm-chat.dm-min .dm-msgs,.tarjeta.dm-chat.dm-min .dm-pie{display:none}
  .dm-msg{max-width:86%;padding:7px 10px;border-radius:10px;line-height:1.42}
  .dm-msg.yo{align-self:flex-end;border-bottom-right-radius:3px}
  .dm-msg.dom{align-self:flex-start;border-bottom-left-radius:3px}
  .dm-msg.err{align-self:center;max-width:96%;text-align:center;color:#ffb3bb;border:1px solid rgba(255,90,110,.5);background:rgba(120,20,40,.25)}
  .dm-msg.aviso{align-self:center;max-width:96%;text-align:center;font-style:italic;opacity:.85;border:1px dashed currentColor;background:transparent}
  .dm-pensando{display:inline-flex;gap:4px;padding:3px 2px}
  .dm-pensando i{width:6px;height:6px;border-radius:50%;background:currentColor;animation:dmPuntos 1s infinite ease-in-out}
  .dm-pensando i:nth-child(2){animation-delay:.15s}.dm-pensando i:nth-child(3){animation-delay:.3s}
  @keyframes dmPuntos{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
  .tarjeta.dm-resp .dm-pie{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 12px 10px}
  .tarjeta.dm-citada{animation:dmCitada 1.4s ease-out}
  @keyframes dmCitada{0%,100%{filter:none}25%{filter:brightness(1.5) drop-shadow(0 0 14px #fff)}}
  .dm-sim{position:absolute;right:10px;top:52px;z-index:8;display:none;flex-direction:column;gap:6px;padding:10px;border-radius:6px;
    background:rgba(0,0,0,.78);border:1px solid rgba(255,255,255,.25);font:12px system-ui;color:#eee}
  .dm-sim.ver{display:flex}
  .dm-sim label{display:flex;gap:6px;align-items:center}
  .dm-sim a{color:#bfe4ff}`;

/* ------------------------------------------------------------ */
export function instalarDominus(ctx) {
  const { tema: idTema, S, meta, escena, zona, poner, getModo, buscar, hacerMovible, abrirLector, otro } = ctx;
  const T = TEMAS[idTema];
  const $ = id => document.getElementById(id);
  const st = document.createElement('style'); st.textContent = CSS_BASE + T.css; document.head.append(st);

  /* lienzo de rayos encima del modelo */
  const cv = document.createElement('canvas'); cv.id = 'dm-rayos'; $('stage').after(cv);
  const g = cv.getContext('2d');
  let dpr = 1;
  const ajustar = () => { dpr = Math.min(1.5, devicePixelRatio || 1); cv.width = zona.clientWidth * dpr; cv.height = zona.clientHeight * dpr; };
  new ResizeObserver(ajustar).observe(zona); ajustar();


  /* sugerencia con el comando */
  const sug = document.createElement('button'); sug.type = 'button'; sug.textContent = '✦ /Dominus nostrum';
  $('cerrarTodas').after(sug);
  const sugExt = document.createElement('button'); sugExt.type = 'button'; sugExt.textContent = '⏱ /extender(5)'; sugExt.style.display = 'none';
  sugExt.onclick = () => manejar('/extender(5)');
  sug.after(sugExt);

  /* ☰ → opciones del prototipo (simular resultados) */
  const sim = document.createElement('div'); sim.className = 'dm-sim';
  sim.innerHTML = `<b>Prototipo · simular</b>
    <label><input type="radio" name="dmsim" value="ok" checked> Respuesta normal</label>
    <label><input type="radio" name="dmsim" value="nodice"> Los fragmentos no lo dicen</label>
    <label><input type="radio" name="dmsim" value="limite"> Límite diario alcanzado</label>
    <label><input type="radio" name="dmsim" value="red"> Sin internet</label>
`;
  document.body.append(sim);
  document.querySelector('.boton-menu').onclick = () => sim.classList.toggle('ver');
  const simulacion = () => (sim.querySelector('input:checked') || {}).value || 'ok';

  /* panel de confirmación */
  const panel = document.createElement('div'); panel.className = 'dm-panel'; zona.append(panel);

  /* ---------------- estado visual ---------------- */
  let I = 0, metaI = 0;               // intensidad del modo (0..1)
  let rayos = [], ultimoRayo = 0, fase = 'nada';

  /* Cuando la conversación está abierta, el asistente se encoge y sube; lo mismo los rayos */
  let enc = { k: 1, ty: 0 }, encMeta = { k: 1, ty: 0 };
  const proyectarVisible = p => {
    const c = escena.proyectar(p), W = zona.clientWidth / 2, H = zona.clientHeight / 2;
    return { x: W + (c.x - W) * enc.k, y: H + (c.y - H) * enc.k + enc.ty };
  };
  function centroYRadio() {
    const c = proyectarVisible(new THREE.Vector3());
    const R = Math.min(zona.clientWidth, zona.clientHeight) * .33 * (S.zoom || 1) * enc.k;
    return { x: c.x, y: c.y, R };
  }
  function acomodar() {
    const v = conv && conv.ventana && conv.ventana.isConnected && !conv.ventana.classList.contains('dm-min') ? conv.ventana : null;
    /* con la conversación abierta, las ventanas de fragmentos se quedan recogidas */
    $('resultados').classList.toggle('dm-replegado', !!v || fase === 'pensando');
    if (!v) encMeta = { k: 1, ty: 0 };
    else {
      const arriba = 92, abajo = v.offsetTop - 8, alto = Math.max(120, abajo - arriba);
      const k = Math.max(.42, Math.min(1, alto / (Math.min(zona.clientWidth, zona.clientHeight) * .78)));
      encMeta = { k, ty: (arriba + abajo) / 2 - zona.clientHeight / 2 };
    }
  }
  function aplicarEncogido(dT) {
    const f = 1 - Math.pow(.88, dT / 16.7);
    enc.k += (encMeta.k - enc.k) * f; enc.ty += (encMeta.ty - enc.ty) * f;
    if (Math.abs(enc.k - 1) < .002 && Math.abs(enc.ty) < .5 && encMeta.k === 1) { enc.k = 1; enc.ty = 0; }
    const tr = enc.k === 1 && !enc.ty ? '' : `translateY(${enc.ty}px) scale(${enc.k})`;
    $('stage').style.transform = tr;
    document.querySelectorAll('.reticula,.esfera').forEach(e => e.style.transform = tr ? `translate(-50%,-50%) ${tr}` : '');
  }
  /* Rayos que GIRAN alrededor del asistente: cada uno recorre un trozo de una
     órbita inclinada; la parte de atrás se ve más tenue (sensación de 3D). */
  function nuevoRayo(R) {
    return {
      rr: R * (.92 + Math.random() * .45), fy: .18 + Math.random() * .8, phi: Math.random() * Math.PI,
      a0: Math.random() * Math.PI * 2, span: .6 + Math.random() * 1.3,
      w: (Math.random() < .5 ? -1 : 1) * (.0022 + Math.random() * .004),
      vida: 0, dura: 600 + Math.random() * 900, color: T.rayo[Math.floor(Math.random() * T.rayo.length)],
      ancho: 1 + Math.random() * 1.4, fase: Math.random() * 6.28
    };
  }
  const enOrbita = (r, a, extra = 0) => {            // punto de la órbita (con desplazamiento radial «extra»)
    const x = Math.cos(a) * (r.rr + extra), y = Math.sin(a) * (r.rr + extra) * r.fy;
    return [x * Math.cos(r.phi) - y * Math.sin(r.phi), x * Math.sin(r.phi) + y * Math.cos(r.phi), Math.sin(a)];
  };
  let chispas = [];

  let last = performance.now();
  function cuadro(t) {
    const dT = Math.min(50, t - last); last = t;
    acomodar(); aplicarEncogido(dT);
    I += (metaI - I) * (1 - Math.pow(.92, dT / 16.7));
    S.caos = Math.min(1, I * 1.7);                     // inestabilidad de la escena
    if (metaI > 0 && (getModo() === 'activo' || getModo() === 'dominus' || getModo() === 'buscando')) meta.mult = 3;   // velocidad x3
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cv.width, cv.height);

    if (I > .01) {
      S.destello.color.set(T.tinte); S.destello.k = Math.max(S.destello.k, I * T.tinteK); S.destello.h = 60;
      const { x: cx, y: cy, R } = centroYRadio();
      g.globalCompositeOperation = 'lighter';
      const pul = .55 + .45 * Math.sin(t * .004);
      const au = g.createRadialGradient(cx, cy, R * .1, cx, cy, R * 1.4);
      au.addColorStop(0, T.aura + (.3 * I * pul) + ')'); au.addColorStop(.5, T.aura + (.11 * I) + ')'); au.addColorStop(1, T.aura + '0)');
      g.fillStyle = au; g.beginPath(); g.arc(cx, cy, R * 1.4, 0, Math.PI * 2); g.fill();

      const cada = fase === 'pensando' ? 70 : 150;
      if (t - ultimoRayo > cada / Math.max(.3, I) && rayos.length < 10) { ultimoRayo = t; rayos.push(nuevoRayo(R)); }
      rayos = rayos.filter(r => (r.vida += dT) < r.dura);
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const r of rayos) {
        r.a0 += r.w * .6 * dT * (fase === 'pensando' ? 1.6 : 1);
        const vida = r.vida / r.dura, env = Math.sin(Math.PI * vida);     // nace y se apaga suave
        const N = 26, pts = [];
        if (T.estilo === 'electrico') {
          /* arco eléctrico: zigzag que cambia en cada cuadro */
          /* el zigzag se rehace cada pocos cuadros (no en todos) para que sea ligero */
          if (!r.pts || (r.cuenta = (r.cuenta || 0) + 1) % 3 === 0) {
            r.offs = []; for (let k = 0; k <= N; k++) r.offs.push((k && k < N) ? (Math.random() - .5) * R * .09 : 0);
          }
          for (let k = 0; k <= N; k++) pts.push(enOrbita(r, r.a0 + r.span * k / N, r.offs[k])); r.pts = pts;
          const al = I * env * (Math.random() < .1 ? .4 : 1);
          for (const delante of [false, true]) {          // atrás más tenue, adelante más brillante
            g.beginPath();
            for (let k = 1; k <= N; k++) if ((pts[k - 1][2] > 0) === delante) { g.moveTo(cx + pts[k - 1][0], cy + pts[k - 1][1]); g.lineTo(cx + pts[k][0], cy + pts[k][1]); }
            const prof = delante ? 1 : .45;
            g.globalAlpha = 1; g.strokeStyle = T.brillo + (.22 * al * prof) + ')'; g.lineWidth = r.ancho * 6; g.stroke();     // resplandor
            g.strokeStyle = T.brillo + (.35 * al * prof) + ')'; g.lineWidth = r.ancho * 2.6; g.stroke();
            g.globalAlpha = al * prof; g.strokeStyle = r.color; g.lineWidth = r.ancho; g.stroke(); g.globalAlpha = 1;
          }
          if (Math.random() < .25) {                       // pequeña ramita que salta del arco
            const [bx, by] = pts[Math.floor(Math.random() * N)], a = Math.random() * 6.28, L = R * (.06 + Math.random() * .1);
            g.globalAlpha = al * .8; g.strokeStyle = r.color; g.lineWidth = .8; g.beginPath(); g.moveTo(cx + bx, cy + by);
            g.lineTo(cx + bx + Math.cos(a) * L * .5 + (Math.random() - .5) * L * .4, cy + by + Math.sin(a) * L * .5 + (Math.random() - .5) * L * .4);
            g.lineTo(cx + bx + Math.cos(a) * L, cy + by + Math.sin(a) * L); g.stroke(); g.globalAlpha = 1;
          }
        } else {
          /* estela mágica: dos hebras suaves que se entrelazan, con cola que se desvanece */
          const TR = 5;                                    // la estela se dibuja en 5 tramos (de cola a cabeza)
          for (const lado of [1, -1]) {
            const pts = [];
            for (let k = 0; k <= N; k++) { const u = k / N; pts.push(enOrbita(r, r.a0 + r.span * u, Math.sin(u * 9 + t * .0036 + r.fase) * R * .028 * lado)); }
            for (let q = 0; q < TR; q++) {
              const k0 = Math.floor(q * N / TR), k1 = Math.floor((q + 1) * N / TR), u = (q + 1) / TR;
              const prof = pts[k0][2] > 0 ? 1 : .5, al = I * env * u * u * prof;
              g.beginPath(); g.moveTo(cx + pts[k0][0], cy + pts[k0][1]); for (let k = k0 + 1; k <= k1; k++) g.lineTo(cx + pts[k][0], cy + pts[k][1]);
              g.globalAlpha = 1; g.strokeStyle = T.brillo + (.2 * al) + ')'; g.lineWidth = r.ancho * 6 * u; g.stroke();
              g.globalAlpha = al; g.strokeStyle = r.color; g.lineWidth = r.ancho * (.4 + u); g.stroke(); g.globalAlpha = 1;
            }
          }
          /* la cabeza de la estela suelta chispas que flotan */
          if (chispas.length < 70 && Math.random() < .4 * I) {
            const [hx, hy] = enOrbita(r, r.a0 + r.span);
            chispas.push({ x: cx + hx, y: cy + hy, vx: (Math.random() - .5) * .05, vy: (Math.random() - .5) * .05 - .015, vida: 0, dura: 500 + Math.random() * 700,
              c: T.chispa[Math.floor(Math.random() * T.chispa.length)], s: .8 + Math.random() * 1.8 });
          }
        }
        g.shadowBlur = 0;
      }
      chispas = chispas.filter(p => (p.vida += dT) < p.dura);
      for (const p of chispas) {
        p.x += p.vx * dT; p.y += p.vy * dT; const k = 1 - p.vida / p.dura;
        g.fillStyle = p.c;
        g.globalAlpha = k * I * .22; g.beginPath(); g.arc(p.x, p.y, p.s * 3 * (.5 + .5 * k), 0, Math.PI * 2); g.fill();   // halo ligero
        g.globalAlpha = k * I; g.beginPath(); g.arc(p.x, p.y, p.s * (.5 + .5 * k), 0, Math.PI * 2); g.fill();
        if (p.s > 2.2) { g.fillRect(p.x - p.s * 2.2 * k, p.y - .4, p.s * 4.4 * k, .8); g.fillRect(p.x - .4, p.y - p.s * 2.2 * k, .8, p.s * 4.4 * k); }  // destello en cruz
      }
      g.globalAlpha = 1; g.shadowBlur = 0;
      g.globalCompositeOperation = 'source-over';
    } else { rayos = []; chispas = []; }
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  function entrar(texto, pensando) {
    poner('dominus', texto);
    $('chip').classList.add('on', 'dm');
    meta.energy = 1; meta.mult = 3; meta.temblor = pensando ? .25 : 0;
    metaI = pensando ? 1 : .55; fase = pensando ? 'pensando' : 'abierto';
  }
  function salir(texto, color) {
    metaI = dmOn ? .5 : 0; fase = dmOn ? 'abierto' : 'nada'; $('resultados').classList.remove('dm-replegado');
    if (color) { S.destello.color.set(color); S.destello.k = 1; S.destello.h = 900; }
    poner('activo', texto);
  }

  /* ---------------- interruptor del modo (5 min) ---------------- */
  const DURACION = 5 * 60 * 1000;
  let dmOn = false, finDm = 0, extendido = 0;          // minutos ya extendidos en esta activación
  function activar() {
    dmOn = true; finDm = performance.now() + DURACION; extendido = 0;
    metaI = .5; fase = 'abierto';
    S.destello.color.set(T.tinte); S.destello.k = 1; S.destello.h = 500;   // destello al despertar
    $('consulta').value = ''; marcar();
    avisar('✦ Dominus nostrum activado · 5 min. Escribe el comando otra vez para apagarlo', 3800);
    setTimeout(() => $('consulta').focus(), 50);
  }
  function desactivar(motivo) {
    if (!dmOn) return;
    dmOn = false; metaI = 0; fase = 'nada';
    $('chip').classList.remove('dm'); $('consulta').value = '';
    panel.classList.remove('ver'); $('resultados').classList.remove('dm-replegado');
    const habia = !!conv; borrarConversacion();
    if (getModo() === 'activo') poner('activo');
    const borrado = habia ? ' · conversación borrada' : '';
    if (motivo === 'tiempo') avisar('Dominus nostrum se desactivó (pasaron 5 minutos)' + borrado);
    else if (motivo === 'comando') avisar('Dominus nostrum desactivado' + borrado);
  }
  function extender(txt) {
    if (!dmOn) return avisar('Dominus nostrum no está activo. Actívalo primero con /Dominus nostrum');
    const n = parseInt((txt || '').replace(/[^\d]/g, ''), 10);
    if (!n || n < 1) return avisar('Escribe los minutos entre paréntesis, por ejemplo /extender(5)');
    const disponible = MAX_EXTENSION - extendido;
    if (disponible <= 0) return avisar(`Ya usaste los ${MAX_EXTENSION} min de extensión de esta activación`);
    const min = Math.min(disponible, n);
    extendido += min; finDm += min * 60000;
    if (conv) conv.aviso30 = false;                      // el aviso de 30 s puede volver a salir
    const resto = mmss(finDm - performance.now());
    const quedaExt = MAX_EXTENSION - extendido;
    avisar((n > min ? `Solo quedaban ${min} min de extensión. ` : '') + `+${min} min · quedan ${resto}` +
      (quedaExt ? ` · puedes extender ${quedaExt} min más` : ' · ya no se puede extender más'), 4500);
    if (conv && conv.ventana) pintarMsg('aviso', `Tiempo extendido ${min} min · quedan ${resto}.`);
    S.destello.color.set(T.tinte); S.destello.k = Math.max(S.destello.k, .8); S.destello.h = 300;   // pequeño destello de confirmación
  }
  const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function marcar() {                      // chip, contador y barra mientras el modo está encendido
    const i = $('consulta');
    const quedaExt = MAX_EXTENSION - extendido, paso = Math.min(5, quedaExt);
    sugExt.style.display = dmOn && quedaExt > 0 ? '' : 'none'; sugExt.disabled = getModo() !== 'activo';
    sugExt.textContent = `⏱ /extender(${paso})`; sugExt.onclick = () => manejar(`/extender(${paso})`);
    if (!dmOn) { if (getModo() === 'activo' && abiertas().length) i.placeholder = 'Busca otra cosa o activa /Dominus nostrum…'; return; }
    $('chip').classList.add('on', 'dm');
    if (getModo() === 'activo') {
      $('estado').textContent = 'Dominus nostrum · ' + mmss(finDm - performance.now());
      i.placeholder = conv ? 'Continúa la conversación…' : 'Pregúntale a Dominus nostrum sobre lo encontrado…';
    }
  }
  setInterval(() => {
    if (dmOn && getModo() === 'apagado') return desactivar('apagado');
    if (dmOn && getModo() === 'activo' && performance.now() >= finDm) return desactivar('tiempo');
    /* últimos 30 s: el brillo late para avisar que se acaba */
    if (dmOn && conv && conv.ventana && !conv.aviso30 && finDm - performance.now() < 30000) {
      conv.aviso30 = true; pintarMsg('aviso', 'Quedan 30 segundos. Al apagarse el modo, esta conversación se borra.');
    }
    if (dmOn && fase === 'abierto') { const r = finDm - performance.now(); metaI = r < 30000 ? .3 + .25 * (Math.sin(performance.now() / 180) > 0) : .5; }
    marcar();
  }, 250);

  /* Lo que se escribe en la consola: true si Dominus se encargó */
  function manejar(q) {
    const ext = sinAcentos(q).match(RE_EXTENDER);
    if (ext) { extender(ext[1]); return true; }          // nunca se envía a Dominus nostrum
    if (esComando(q)) {
      const resto = q.slice((sinAcentos(q).match(RE_COMANDO) || [''])[0].length).trim();
      if (dmOn) { desactivar('comando'); return true; }
      if (getModo() === 'apagado') { avisar('Primero toca a ' + T.nombre + ' para encenderlo'); return true; }
      activar();
      if (resto) intentar(resto);
      return true;
    }
    if (dmOn) { intentar(q); return true; }
    return false;
  }

  /* ---------------- flujo ---------------- */
  const abiertas = () => [...$('resultados').querySelectorAll('.tarjeta:not(.cerrando):not(.dm-resp)')];
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- conversación (solo vive mientras el modo está encendido) ---------------- */
  let conv = null;                 // { frags:[{n,ref,tipo,texto}], msgs:[{rol,texto}], ventana }
  const nuevaConv = () => ({ frags: [], msgs: [], vista: [], ventana: null });
  const refDe = t => t.querySelector('.ref').textContent;

  function iniciar(textoCompleto) {
    const pregunta = textoCompleto.trim();
    $('consulta').value = '';
    if (!pregunta) return;
    if (!conv) conv = nuevaConv();
    const yaEnviadas = new Set(conv.frags.map(f => f.ref));
    const nuevas = abiertas().filter(t => !yaEnviadas.has(refDe(t)));
    if (nuevas.length) return confirmar(pregunta, nuevas);            // hay fragmentos nuevos: se muestran antes de enviar
    if (conv.frags.length) return consultar(pregunta, []);             // seguimos la plática con el mismo contexto
    /* primera pregunta sin ventanas abiertas: primero busca el cerebro local */
    buscar(pregunta);
    const espera = setInterval(() => {
      if (getModo() === 'activo' && abiertas().length) { clearInterval(espera); setTimeout(() => confirmar(pregunta, abiertas()), 1500); }
    }, 200);
    setTimeout(() => clearInterval(espera), 9000);
  }

  function confirmar(pregunta, ventanas) {
    let sig = conv.frags.length;
    const frags = ventanas.map(t => ({ t, n: ++sig, ref: refDe(t), tipo: t.querySelector('.tipo').textContent, texto: t.querySelector('p').textContent }));
    frags.forEach(f => { let b = f.t.querySelector('.dm-num'); if (!b) { b = document.createElement('span'); b.className = 'dm-num'; f.t.querySelector('.ref').before(b); } b.textContent = f.n; });
    entrar('Dominus nostrum · preparando', false);
    const previos = conv.frags.length;
    const palabras = () => frags.filter(f => !f.off).reduce((s, f) => s + f.texto.split(/\s+/).length, 0) + pregunta.split(/\s+/).length;
    panel.innerHTML = `<h4>DOMINUS NOSTRUM</h4>
      <p class="dm-sub">${previos ? 'Fragmentos <b>nuevos</b> que se agregarían a la conversación' : 'Consulta externa · esto es <b>todo</b> lo que saldrá del dispositivo'}</p>
      <div class="dm-preg"><b>Tu pregunta:</b> ${esc(pregunta)}</div>
      ${frags.map((f, i) => `<label class="dm-frag" data-i="${i}"><input type="checkbox" checked><span class="dm-n">${f.n}</span><span><b>${esc(f.ref)}</b> · ${esc(f.tipo)}<span class="dm-prev">${esc(f.texto)}</span></span></label>`).join('')}
      <div class="dm-nota" id="dmNota"></div>
      <div class="dm-botones"><button type="button" id="dmCancelar">Cancelar</button><button type="button" class="dm-prim" id="dmEnviar">✦ Consultar</button></div>`;
    const nota = () => {
      const n = frags.filter(f => !f.off).length;
      panel.querySelector('#dmNota').innerHTML = (previos ? `Ya tiene ${previos} fragmento${previos === 1 ? '' : 's'} de esta conversación. Se ${n === 1 ? 'agrega' : 'agregan'} <b>${n}</b> más` : `Se envían tu pregunta y <b>${n}</b> fragmento${n === 1 ? '' : 's'}`) +
        ` (≈ ${palabras()} palabras). El documento completo no sale. Responderá <b>solo con lo que digan los fragmentos</b>, citando [n].<br>Cerebro: Gemini · plan gratuito (lo enviado puede usarse para mejorar sus productos).`;
      panel.querySelector('#dmEnviar').disabled = n === 0 && !previos;
    };
    panel.querySelectorAll('.dm-frag').forEach(l => l.querySelector('input').onchange = e => { const f = frags[l.dataset.i]; f.off = !e.target.checked; l.classList.toggle('off', f.off); nota(); });
    nota();
    panel.querySelector('#dmCancelar').onclick = () => { panel.classList.remove('ver'); frags.forEach(f => { const b = f.t.querySelector('.dm-num'); if (b) b.remove(); }); salir(); };
    panel.querySelector('#dmEnviar').onclick = () => { panel.classList.remove('ver'); consultar(pregunta, frags.filter(f => !f.off)); };
    requestAnimationFrame(() => panel.classList.add('ver'));
  }

  function consultar(pregunta, nuevos) {
    nuevos.forEach(f => conv.frags.push({ n: f.n, ref: f.ref, tipo: f.tipo, texto: f.texto }));
    conv.msgs.push({ rol: 'yo', texto: pregunta });
    abrirChat(); pintarMsg('yo', esc(pregunta));
    const escribiendo = pintarMsg('dom', '<span class="dm-pensando"><i></i><i></i><i></i></span>');
    entrar('Dominus nostrum · consultando afuera', true);
    $('resultados').classList.add('dm-replegado');          // las ventanas de fragmentos se repliegan; la conversación queda
    const modoSim = simulacion();
    setTimeout(() => {
      escribiendo.remove();
      if (!conv) return;                                     // se apagó mientras pensaba: no queda nada
      if (modoSim === 'limite' || modoSim === 'red') {
        conv.msgs.pop();                                     // esa pregunta no llegó: no cuenta como contexto
        salir('no se pudo consultar', '#ff4d5e');
        return pintarMsg('err', modoSim === 'limite' ? 'Se alcanzó el límite gratuito de hoy. La búsqueda local sigue funcionando.' : 'Sin internet: no pude consultar. La búsqueda local sigue funcionando.');
      }
      const txt = respuestaSimulada(pregunta, modoSim);
      conv.msgs.push({ rol: 'dom', texto: txt.replace(/<[^>]+>/g, '') });
      salir('respuesta lista', T.tinte);
      pintarMsg('dom', txt);
    }, 3200);
  }

  const cita = n => `<button type="button" class="dm-cita" data-n="${n}">${n}</button>`;
  function respuestaSimulada(pregunta, modoSim) {
    const ns = conv.frags.map(f => f.n), turno = conv.msgs.filter(m => m.rol === 'yo').length;
    if (modoSim === 'nodice') return `Los fragmentos de esta conversación no dicen nada sobre eso: ${cita(ns[0])} trata otro tema${ns[1] ? ` y ${cita(ns[1])} tampoco lo menciona` : ''}. Puedes apagar el modo, buscar con otras palabras y volver a preguntar.`;
    if (turno === 1) return `<i>Respuesta de ejemplo.</i> Sobre «${esc(pregunta)}»: lo que tienen en común ${cita(ns[0])}${ns[1] ? ` y ${cita(ns[1])}` : ''}, en qué se diferencian${ns[2] ? `, y cómo ${cita(ns[2])} lo completa` : ''}. Si algo no está en ellos, lo digo en vez de suponerlo.`;
    const k = ns[(turno - 1) % ns.length];
    return `<i>Respuesta de ejemplo (turno ${turno}).</i> Siguiendo con lo que platicamos: sobre «${esc(pregunta)}», ${cita(k)} lo aclara${ns.length > 1 ? `, y se relaciona con lo que te dije antes de ${cita(ns[0])}` : ''}. Recuerdo toda esta conversación mientras el modo siga encendido.`;
  }

  let zTop = 500;
  function abrirChat() {
    if (conv.ventana && conv.ventana.isConnected) { conv.ventana.classList.remove('dm-min'); return; }
    const t = document.createElement('div'); t.className = 'tarjeta dm-resp dm-chat'; t.dataset.corta = '✦';
    t.style.width = Math.min(zona.clientWidth * .92, 400) + 'px'; t.style.zIndex = ++zTop;
    t.innerHTML = `<div class="cab"><span class="agarre">⋮⋮</span><span class="ref">✦ Dominus nostrum</span><span class="tipo">conversación</span><button class="dm-mini x" type="button" title="Minimizar">–</button></div>
      <div class="dm-msgs"></div>
      <div class="dm-pie"><span class="dm-ctx"></span><button type="button" class="dm-enviado">Qué se ha enviado</button></div>`;
    t.querySelector('.dm-mini').onclick = () => {
      t.classList.toggle('dm-min');
      if (!t.dataset.movida) t.style.top = Math.max(90, zona.clientHeight - t.offsetHeight - 10) + 'px';
    };
    t.querySelector('.dm-enviado').onclick = () => abrirLector('Contexto de esta conversación',
      `<p><i>Instrucción fija: responde solo con base en estos fragmentos y en esta conversación; cita cada idea con [n]; si no está en ellos, dilo.</i></p>` +
      conv.frags.map(f => `<p><b>[${f.n}] ${esc(f.ref)} · ${esc(f.tipo)}</b><br>${esc(f.texto)}</p>`).join('') +
      conv.msgs.map(m => `<p><b>${m.rol === 'yo' ? 'Tú' : 'Dominus nostrum'}:</b> ${esc(m.texto)}</p>`).join('') +
      `<p><i>Todo esto se borra al apagar el modo.</i></p>`);
    $('resultados').append(t);
    t.style.left = Math.max(6, (zona.clientWidth - t.offsetWidth) / 2) + 'px';
    t.style.top = Math.max(90, zona.clientHeight - t.offsetHeight - 10) + 'px';
    hacerMovible(t);
    t.querySelector('.cab').addEventListener('pointermove', e => { if (e.buttons) t.dataset.movida = 1; });
    t.animate([{ transform: 'scale(.05)', opacity: 0, filter: 'brightness(3)' }, { transform: 'scale(1.03)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1, filter: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.9,.3,1)' });
    t.classList.add('visible');
    conv.ventana = t;
    const previa = conv.vista; conv.vista = [];                 // si la cerraste con «Cerrar todas», se rehace igual
    previa.forEach(([r, h]) => pintarMsg(r, h));
  }
  function pintarMsg(rol, html) {
    const caja = conv.ventana.querySelector('.dm-msgs');
    const m = document.createElement('div'); m.className = 'dm-msg ' + rol; m.innerHTML = html; caja.append(m);
    if (!html.includes('dm-pensando')) conv.vista.push([rol, html]);
    m.querySelectorAll('.dm-cita').forEach(b => b.onclick = () => {      // la cita abre el fragmento en el lector
      const f = conv && conv.frags.find(x => String(x.n) === b.dataset.n);
      if (f) abrirLector(`[${f.n}] ${f.ref} · ${f.tipo}`, `<p>${esc(f.texto)}</p>`);
    });
    caja.scrollTop = caja.scrollHeight;
    conv.ventana.querySelector('.dm-ctx').textContent = `${conv.frags.length} fragmento${conv.frags.length === 1 ? '' : 's'} · ${conv.msgs.length} mensaje${conv.msgs.length === 1 ? '' : 's'}`;
    /* la ventana se ajusta a la altura disponible */
    const t = conv.ventana;                                   // siempre acomodada abajo, sin tapar al asistente
    if (!t.dataset.movida) t.style.top = Math.max(90, zona.clientHeight - t.offsetHeight - 10) + 'px';
    return m;
  }
  function borrarConversacion() {
    if (!conv) return;
    if (conv.ventana) { const v = conv.ventana; v.classList.add('cerrando'); setTimeout(() => v.remove(), 300); }
    document.querySelectorAll('#resultados .dm-num').forEach(b => b.remove());
    conv = null;
  }

  /* avisos visibles (prototipo): si algo falla, se ve en pantalla */
  const toast = document.createElement('div'); toast.id = 'dm-toast';
  toast.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);max-width:90vw;z-index:20;padding:8px 14px;border-radius:8px;font:13px system-ui;color:#fff;background:rgba(0,0,0,.82);border:1px solid rgba(255,255,255,.3);display:none;text-align:center';
  document.body.append(toast);
  const avisar = (txt, ms = 3500) => { toast.textContent = txt; toast.style.display = 'block'; clearTimeout(avisar.t); avisar.t = setTimeout(() => toast.style.display = 'none', ms); };
  addEventListener('error', e => avisar('Error: ' + (e.message || e.error), 9000));
  addEventListener('unhandledrejection', e => avisar('Error: ' + e.reason, 9000));

  function intentar(q) {
    if (!q) return;
    const modo = getModo();
    if (modo === 'apagado') return avisar('Primero toca a ' + T.nombre + ' para encenderlo');
    if (modo !== 'activo') return avisar('Espera a que ' + T.nombre + ' termine (' + modo + ')');
    try { iniciar(q); } catch (e) { avisar('Error: ' + e.message, 9000); }
  }
  /* la sugerencia ✦ funciona como el comando: enciende o apaga el modo */
  sug.onclick = () => manejar('/Dominus nostrum');

  return { manejar };
}
