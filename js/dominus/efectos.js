/* ============================================================
   Dominus nostrum — efectos visuales (solo mientras está encendido).
   Según prototipo/dominus/dominus.js:
   - intensidad I (0…1) que se suaviza hacia su meta
     (0.5 encendido, 1 consultando, 0 apagado; late en los últimos 30 s)
   - S.caos = mín(1, I × 1.7) y brillo platino azulado (S.destello)
   - lienzo 2D encima de la escena (sin recibir toques) con un aura
     que respira y rayos que GIRAN alrededor del asistente en órbitas
     elípticas inclinadas (la parte de atrás, más tenue):
       Agios: eléctricos · Kyrien: mágicos (hebras y chispas)
   - encogido: con la conversación abierta, el asistente (su capa), el
     fondo del tema y los rayos se encogen y suben al espacio libre
     entre el título y la conversación.
   Rendimiento (obligatorio): nada de shadowBlur; resplandor con trazos
   anchos semitransparentes; máx. 10 rayos y 70 chispas;
   devicePixelRatio ≤ 1.5; un solo trazo por tramo.
   ============================================================ */
import * as THREE from 'three';

const TEMAS = {
  agios: {
    tinte: '#dbe6f7', tinteK: 0.78, estilo: 'electrico',
    rayo: ['#ffffff', '#e4edff', '#bcd2f5'], brillo: 'rgba(160,190,240,', aura: 'rgba(205,220,245,',
  },
  kyrien: {
    tinte: '#dbe6f7', tinteK: 0.72, estilo: 'magia',
    rayo: ['#f4f8ff', '#d3e1f8', '#b9cdf0'], chispa: ['#ffffff', '#e8f0ff', '#ffe6b0'],
    brillo: 'rgba(170,195,240,', aura: 'rgba(210,224,248,',
  },
};
export const temaEfectos = t => TEMAS[t] || TEMAS.agios;

const MAX_RAYOS = 10, MAX_CHISPAS = 70, MAX_DPR = 1.5;
const ARRIBA = 92;                       // bajo el título del asistente
const ORIGEN_Y = 0.52;                   // transform-origin de .capa y centro de la retícula/esfera

export function crearEfectos({ zona, stage }) {
  const cv = document.createElement('canvas');
  cv.id = 'dm-rayos'; cv.setAttribute('aria-hidden', 'true');
  stage.after(cv);
  const g = cv.getContext('2d');
  let dpr = 1, W = 0, H = 0;
  const ajustar = () => {
    dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    W = zona.clientWidth; H = zona.clientHeight;
    cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
  };
  new ResizeObserver(ajustar).observe(zona); ajustar();

  let I = 0, metaI = 0, fase = 'nada';          // fase: 'nada' | 'abierto' | 'pensando'
  let rayos = [], chispas = [], ultimoRayo = 0, pintado = false;
  let enc = { k: 1, ty: 0 }, encMeta = { k: 1, ty: 0 };
  let transformados = [], ultimaTr = '';
  const v0 = new THREE.Vector3();

  /* ---------- encogido ---------- */
  const O = () => ({ x: zona.clientWidth / 2, y: zona.clientHeight * ORIGEN_Y });
  /** Posición en pantalla de un punto 3D tal como se ve (con el encogido aplicado) */
  function proyectarVisible(escena, p) {
    const c = escena.proyectar(p), o = O();
    return { x: o.x + (c.x - o.x) * enc.k, y: o.y + (c.y - o.y) * enc.k + enc.ty };
  }
  /** Meta del encogido según la ventana de conversación (o null si no está abierta) */
  function acomodar(escena, chat) {
    if (!chat) { encMeta = { k: 1, ty: 0 }; return; }
    const abajo = chat.offsetTop - 8, alto = Math.max(120, abajo - ARRIBA);
    const k = Math.max(0.42, Math.min(1, alto / (0.78 * Math.min(zona.clientWidth, zona.clientHeight))));
    const o = O(), c0 = escena.proyectar(v0.set(0, 0, 0));
    encMeta = { k, ty: (ARRIBA + abajo) / 2 - o.y - k * (c0.y - o.y) };
  }
  function aplicarEncogido(dT, elementos) {
    const f = 1 - Math.pow(0.88, dT / 16.7);
    enc.k += (encMeta.k - enc.k) * f; enc.ty += (encMeta.ty - enc.ty) * f;
    if (encMeta.k === 1 && encMeta.ty === 0 && Math.abs(enc.k - 1) < 0.002 && Math.abs(enc.ty) < 0.5) enc = { k: 1, ty: 0 };
    const tr = enc.k === 1 && enc.ty === 0 ? '' : `translateY(${enc.ty.toFixed(2)}px) scale(${enc.k.toFixed(4)})`;
    if (tr === ultimaTr && (!tr || elementos.every((e, i) => e === transformados[i]))) return;
    limpiarTransformaciones();
    if (tr) {
      for (const e of elementos) e.style.transform = e.classList.contains('capa') ? tr : `translate(-50%,-50%) ${tr}`;
      transformados = elementos.slice();
    }
    ultimaTr = tr;
  }
  function limpiarTransformaciones() {
    for (const e of transformados) e.style.transform = '';
    transformados = [];
    ultimaTr = '';
  }

  /* ---------- rayos ---------- */
  function nuevoRayo(R, T) {
    return {
      rr: R * (0.92 + Math.random() * 0.45), fy: 0.18 + Math.random() * 0.8, phi: Math.random() * Math.PI,
      a0: Math.random() * Math.PI * 2, span: 0.6 + Math.random() * 1.3,
      w: (Math.random() < 0.5 ? -1 : 1) * (0.0022 + Math.random() * 0.004),
      vida: 0, dura: 600 + Math.random() * 900, color: T.rayo[Math.floor(Math.random() * T.rayo.length)],
      ancho: 1 + Math.random() * 1.4, fase: Math.random() * 6.28, cuenta: 0, offs: null,
    };
  }
  /* punto de la órbita (con desplazamiento radial «extra»); el 3.º valor dice si va por delante */
  const enOrbita = (r, a, extra = 0) => {
    const x = Math.cos(a) * (r.rr + extra), y = Math.sin(a) * (r.rr + extra) * r.fy;
    return [x * Math.cos(r.phi) - y * Math.sin(r.phi), x * Math.sin(r.phi) + y * Math.cos(r.phi), Math.sin(a)];
  };

  function dibujarRayos(t, dT, T, cx, cy, R) {
    g.globalCompositeOperation = 'lighter';
    const pul = 0.55 + 0.45 * Math.sin(t * 0.004);
    const au = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.4);
    au.addColorStop(0, T.aura + (0.3 * I * pul) + ')'); au.addColorStop(0.5, T.aura + (0.11 * I) + ')'); au.addColorStop(1, T.aura + '0)');
    g.fillStyle = au; g.beginPath(); g.arc(cx, cy, R * 1.4, 0, Math.PI * 2); g.fill();

    const cada = fase === 'pensando' ? 70 : 150;              // nacen más seguido mientras consulta
    if (t - ultimoRayo > cada / Math.max(0.3, I) && rayos.length < MAX_RAYOS) { ultimoRayo = t; rayos.push(nuevoRayo(R, T)); }
    rayos = rayos.filter(r => (r.vida += dT) < r.dura);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const N = 26;
    for (const r of rayos) {
      r.a0 += r.w * 0.6 * dT * (fase === 'pensando' ? 1.6 : 1);   // 60 % de la velocidad original
      const env = Math.sin(Math.PI * r.vida / r.dura);             // nace y se apaga suave
      if (T.estilo === 'electrico') {
        /* arco eléctrico: el zigzag se rehace cada 3 cuadros (no en todos) */
        if (!r.offs || ++r.cuenta % 3 === 0) {
          r.offs = []; for (let k = 0; k <= N; k++) r.offs.push(k && k < N ? (Math.random() - 0.5) * R * 0.09 : 0);
        }
        const pts = [];
        for (let k = 0; k <= N; k++) pts.push(enOrbita(r, r.a0 + r.span * k / N, r.offs[k]));
        const al = I * env * (Math.random() < 0.1 ? 0.4 : 1);       // parpadeo
        for (const delante of [false, true]) {                      // atrás más tenue, adelante más brillante
          g.beginPath();
          for (let k = 1; k <= N; k++) if ((pts[k - 1][2] > 0) === delante) { g.moveTo(cx + pts[k - 1][0], cy + pts[k - 1][1]); g.lineTo(cx + pts[k][0], cy + pts[k][1]); }
          const prof = delante ? 1 : 0.45;
          g.globalAlpha = 1; g.strokeStyle = T.brillo + (0.22 * al * prof) + ')'; g.lineWidth = r.ancho * 6; g.stroke();   // resplandor
          g.strokeStyle = T.brillo + (0.35 * al * prof) + ')'; g.lineWidth = r.ancho * 2.6; g.stroke();
          g.globalAlpha = al * prof; g.strokeStyle = r.color; g.lineWidth = r.ancho; g.stroke(); g.globalAlpha = 1;
        }
        if (Math.random() < 0.25) {                                 // ramita ocasional que salta del arco
          const [bx, by] = pts[Math.floor(Math.random() * N)], a = Math.random() * 6.28, L = R * (0.06 + Math.random() * 0.1);
          g.globalAlpha = al * 0.8; g.strokeStyle = r.color; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx + bx, cy + by);
          g.lineTo(cx + bx + Math.cos(a) * L * 0.5 + (Math.random() - 0.5) * L * 0.4, cy + by + Math.sin(a) * L * 0.5 + (Math.random() - 0.5) * L * 0.4);
          g.lineTo(cx + bx + Math.cos(a) * L, cy + by + Math.sin(a) * L); g.stroke(); g.globalAlpha = 1;
        }
      } else {
        /* estela mágica: dos hebras suaves que se entrelazan, con cola que se desvanece (5 tramos) */
        const TR = 5;
        for (const lado of [1, -1]) {
          const pts = [];
          for (let k = 0; k <= N; k++) { const u = k / N; pts.push(enOrbita(r, r.a0 + r.span * u, Math.sin(u * 9 + t * 0.0036 + r.fase) * R * 0.028 * lado)); }
          for (let q = 0; q < TR; q++) {
            const k0 = Math.floor(q * N / TR), k1 = Math.floor((q + 1) * N / TR), u = (q + 1) / TR;
            const prof = pts[k0][2] > 0 ? 1 : 0.5, al = I * env * u * u * prof;
            g.beginPath(); g.moveTo(cx + pts[k0][0], cy + pts[k0][1]); for (let k = k0 + 1; k <= k1; k++) g.lineTo(cx + pts[k][0], cy + pts[k][1]);
            g.globalAlpha = 1; g.strokeStyle = T.brillo + (0.2 * al) + ')'; g.lineWidth = r.ancho * 6 * u; g.stroke();
            g.globalAlpha = al; g.strokeStyle = r.color; g.lineWidth = r.ancho * (0.4 + u); g.stroke(); g.globalAlpha = 1;
          }
        }
        /* la cabeza de la estela suelta chispas que flotan (algunas doradas) */
        if (chispas.length < MAX_CHISPAS && Math.random() < 0.4 * I) {
          const [hx, hy] = enOrbita(r, r.a0 + r.span);
          chispas.push({ x: cx + hx, y: cy + hy, vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05 - 0.015, vida: 0, dura: 500 + Math.random() * 700,
            c: T.chispa[Math.floor(Math.random() * T.chispa.length)], s: 0.8 + Math.random() * 1.8 });
        }
      }
    }
    chispas = chispas.filter(p => (p.vida += dT) < p.dura);
    for (const p of chispas) {
      p.x += p.vx * dT; p.y += p.vy * dT; const k = 1 - p.vida / p.dura;
      g.fillStyle = p.c;
      g.globalAlpha = k * I * 0.22; g.beginPath(); g.arc(p.x, p.y, p.s * 3 * (0.5 + 0.5 * k), 0, Math.PI * 2); g.fill();   // halo ligero
      g.globalAlpha = k * I; g.beginPath(); g.arc(p.x, p.y, p.s * (0.5 + 0.5 * k), 0, Math.PI * 2); g.fill();
      if (p.s > 2.2) { g.fillRect(p.x - p.s * 2.2 * k, p.y - 0.4, p.s * 4.4 * k, 0.8); g.fillRect(p.x - 0.4, p.y - p.s * 2.2 * k, 0.8, p.s * 4.4 * k); }   // destello en cruz
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  let msUltimo = 0, respetarHasta = 0;     // un destello de otro color (rojo de error) no se tapa con el platino
  return {
    set meta(v) { metaI = v; }, get meta() { return metaI; },
    set fase(v) { fase = v; }, get fase() { return fase; },
    get intensidad() { return I; }, get encogido() { return { ...enc }; },
    get rayos() { return rayos.length; }, get chispas() { return chispas.length; }, get ms() { return msUltimo; },
    get dpr() { return dpr; },
    proyectarVisible,
    /** Centro y radio de los rayos (con el encogido aplicado) */
    centro(escena, S) {
      const c = proyectarVisible(escena, v0.set(0, 0, 0));
      return { x: c.x, y: c.y, R: Math.min(zona.clientWidth, zona.clientHeight) * 0.33 * (S.zoom || 1) * enc.k };
    },
    /**
     * Un cuadro. a: asistente activo {S, tema, capa}; escena: su escena;
     * chat: ventana de conversación abierta (no minimizada) o null;
     * fondos: retícula/esfera que se encogen con el asistente.
     */
    cuadro(t, dT, { a, escena, chat, fondos }) {
      const t0 = performance.now();
      if (a && escena) { acomodar(escena, chat); aplicarEncogido(dT, [a.capa, ...fondos]); }
      I += (metaI - I) * (1 - Math.pow(0.92, dT / 16.7));
      if (metaI === 0 && I < 0.002) I = 0;
      if (a) a.S.caos = Math.min(1, I * 1.7);
      if (I > 0.01 && a && escena) {
        const T = temaEfectos(a.tema);
        if (t0 >= respetarHasta) { a.S.destello.color.set(T.tinte); a.S.destello.k = Math.max(a.S.destello.k, I * T.tinteK); a.S.destello.h = 60; }
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        const { x, y, R } = this.centro(escena, a.S);
        dibujarRayos(t, dT, T, x, y, R);
        pintado = true;
      } else {
        if (pintado) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); pintado = false; }
        rayos = []; chispas = [];
      }
      msUltimo = performance.now() - t0;
    },
    /** Deja ver un destello de otro color (p. ej. rojo de error) sin taparlo con el brillo platino */
    respetarDestello(ms = 1800) { respetarHasta = performance.now() + ms; },
    /** Apagado inmediato (cambio de asistente, menú): sin restos en la escena que se va */
    reiniciar(S) {
      I = 0; metaI = 0; fase = 'nada'; rayos = []; chispas = []; respetarHasta = 0;
      enc = { k: 1, ty: 0 }; encMeta = { k: 1, ty: 0 }; limpiarTransformaciones();
      if (S) S.caos = 0;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); pintado = false;
    },
  };
}
