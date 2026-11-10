/* ============================================================
   Ventanas de resultado (según prototipo/anesthios/):
   - nacen de partículas que se desprenden de los anillos,
   - se acumulan buscando un hueco libre (o en cascada si no cabe),
   - se mueven arrastrando su encabezado (⋮⋮), con dedo o mouse,
     sin salirse de la zona; la que se toca pasa al frente,
   - cada una tiene ✕; «Cerrar todas» cuando hay 2 o más,
   - si la pieza ya está abierta, no se duplica: pasa al frente y destella,
   - si la escena sabe invocar (Kyrien), primero forma el círculo mágico y
     las ventanas nacen del hechizo (puntoDeHechizo); si no, de los anillos.
   Cada asistente tiene su propio gestor y su propio contenedor: al cambiar
   de asistente sus ventanas se guardan (ocultas) y vuelven al regresar.
   ============================================================ */
import { escaparHtml, resaltarHtml } from './texto.js';

export function crearVentanas({ zona, cont, escena, S, tema = 'agios', enlazar = h => h, alVerCompleto, alCambiar, alEnlace = () => {} }) {
  const esc = () => (typeof escena === 'function' ? escena() : escena);
  cont.addEventListener('click', ev => {
    const a = ev.target.closest('a.enlace');
    if (a) { ev.preventDefault(); alEnlace(a); }
  });
  let zSig = 10;
  const datos = new WeakMap();                    // ventana → resultado que muestra (para Dominus nostrum)
  // La ventana de conversación de Dominus nostrum vive en el mismo contenedor, pero no es un resultado.
  const vivas = () => [...cont.querySelectorAll('.tarjeta:not(.cerrando):not(.dm-chat)')];
  const avisar = () => alCambiar?.(vivas().map(t => ({ pieza: t.dataset.pieza, corta: t.dataset.corta })));

  /* Busca un hueco libre para una ventana nueva sin tapar las que ya están */
  function hueco(w, h) {
    const W = zona.clientWidth, H = zona.clientHeight, arriba = 92, abajo = H - 12, m = 12;
    const otras = vivas().filter(t => t.style.visibility !== 'hidden')
      .map(t => ({ x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight }));
    const choca = (x, y) => otras.some(o => x < o.x + o.w - 20 && x + w - 20 > o.x && y < o.y + o.h - 20 && y + h - 20 > o.y);
    const xs = [m, W - w - m, (W - w) / 2];
    for (let y = arriba; y + h <= abajo; y += 24) for (const x of xs) if (!choca(x, y)) return { x, y };
    const n = otras.length;                       // en cascada si ya no cabe
    return { x: m + (n * 26) % Math.max(1, W - w - 2 * m), y: arriba + (n * 30) % Math.max(1, abajo - h - arriba) };
  }

  const limitar = (t, x, y) => {
    const W = zona.clientWidth, H = zona.clientHeight;
    return [Math.max(-t.offsetWidth + 60, Math.min(W - 60, x)), Math.max(0, Math.min(H - 40, y))];
  };

  /* Arrastrar una ventana desde su encabezado (no gira ni enciende a Agios) */
  function hacerMovible(t) {
    const cab = t.querySelector('.cab');
    let ini = null;
    t.addEventListener('pointerdown', ev => { t.style.zIndex = ++zSig; ev.stopPropagation(); });
    cab.addEventListener('pointerdown', ev => {
      if (ev.target.closest('button')) return;
      ev.preventDefault();
      cab.setPointerCapture(ev.pointerId);
      t.classList.add('arrastrando');
      ini = { id: ev.pointerId, px: ev.clientX, py: ev.clientY, x: t.offsetLeft, y: t.offsetTop };
    });
    cab.addEventListener('pointermove', ev => {
      if (!ini || ev.pointerId !== ini.id) return;
      const [x, y] = limitar(t, ini.x + ev.clientX - ini.px, ini.y + ev.clientY - ini.py);
      t.style.left = x + 'px'; t.style.top = y + 'px';
    });
    const soltar = ev => { if (ini && ev.pointerId === ini.id) { ini = null; t.classList.remove('arrastrando'); } };
    cab.addEventListener('pointerup', soltar); cab.addEventListener('pointercancel', soltar);
  }

  function destellar(t) {
    t.style.zIndex = ++zSig;
    t.classList.remove('destella'); void t.offsetWidth; t.classList.add('destella');
  }

  function cerrar(t) {
    if (t.classList.contains('cerrando')) return;
    t.classList.add('cerrando');
    setTimeout(() => { t.remove(); avisar(); }, 300);
    avisar();
  }
  function cerrarTodas() { vivas().forEach(cerrar); }

  /**
   * r: {pieza, ref, tipo, corta, origen, extracto:{texto,intervalos}, pasaje}
   * → cuántas ventanas nuevas se abrieron
   */
  function mostrar(lista) {
    let nuevas = 0;
    const repetidas = [];
    const e0 = esc();
    const porCrear = lista.filter(r => !vivas().some(t => t.dataset.pieza === r.pieza)).length;
    const hechizo = porCrear > 0 && typeof e0?.invocar === 'function';
    if (hechizo) e0.invocar();                    // el círculo mágico se forma primero
    const espera = hechizo ? 1000 : 0;
    lista.forEach(r => {
      const ya = vivas().find(t => t.dataset.pieza === r.pieza);
      if (ya) { repetidas.push(ya); return; }
      const i = nuevas++;
      const t = document.createElement('div');
      t.className = 'tarjeta t-' + (r.tema || tema);
      t.style.zIndex = ++zSig;
      t.dataset.pieza = r.pieza;
      t.dataset.corta = r.corta;
      t.style.width = Math.min(zona.clientWidth * 0.84, 360) + 'px';
      t.innerHTML = `<div class="cab"><span class="agarre">⋮⋮</span><span class="ref">${escaparHtml(r.ref)}</span>` +
        `<span class="tipo">${escaparHtml(r.tipo)}</span><button class="x" type="button" title="Cerrar" aria-label="Cerrar">✕</button></div>` +
        `<p>${enlazar(resaltarHtml(r.extracto.texto, r.extracto.intervalos), r.col)}</p>` +
        `<div class="pie"><span class="origen">${escaparHtml(r.origen || '')}</span><button type="button" class="ver">Ver completo</button></div>`;
      datos.set(t, r);
      t.querySelector('.x').onclick = () => cerrar(t);
      t.querySelector('.ver').onclick = () => alVerCompleto(r);
      t.style.visibility = 'hidden';
      cont.append(t);
      const p = hueco(t.offsetWidth, t.offsetHeight);
      t.style.left = p.x + 'px'; t.style.top = p.y + 'px'; t.style.visibility = '';
      hacerMovible(t);
      avisar();
      // Una partícula se desprende de un anillo y viaja hasta donde nacerá la ventana
      setTimeout(() => {
        if (!t.isConnected) return;
        const e1 = esc();
        const o = hechizo ? e1.puntoDeHechizo(i, porCrear) : e1.puntoDeAnillo(i, S.T * 0.001 + i * 2.1);
        const dx = t.offsetLeft + t.offsetWidth / 2, dy = t.offsetTop + t.offsetHeight / 2;
        const ch = document.createElement('div'); ch.className = 'chispa'; zona.append(ch);
        ch.animate([{ left: o.x + 'px', top: o.y + 'px', transform: 'scale(1)' },
          { left: (o.x + dx) / 2 + (i % 2 ? 40 : -40) + 'px', top: (o.y + dy) / 2 - 30 + 'px', transform: 'scale(1.4)', offset: .55 },
          { left: dx + 'px', top: dy + 'px', transform: 'scale(2.2)' }],
        { duration: 700, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' })
          .onfinish = () => { ch.remove(); t.classList.add('visible'); avisar(); };
      }, espera + i * 260);
    });
    // Las que ya estaban abiertas no se duplican: pasan al frente (encima de
    // las nuevas, en el orden de los resultados) y destellan.
    repetidas.reverse().forEach(destellar);
    return nuevas;
  }

  // Al girar el dispositivo o cambiar el tamaño, ninguna ventana queda fuera de la zona.
  new ResizeObserver(() => {
    for (const t of vivas()) {
      const [x, y] = limitar(t, t.offsetLeft, t.offsetTop);
      t.style.left = x + 'px'; t.style.top = y + 'px';
      t.style.width = Math.min(zona.clientWidth * 0.84, 360) + 'px';
    }
  }).observe(zona);

  return {
    mostrar, cerrar, cerrarTodas, abiertas: () => vivas().length,
    /** Ventanas abiertas con lo que muestra cada una: [{t, r}] en orden de apertura */
    lista: () => vivas().filter(t => datos.has(t)).map(t => ({ t, r: datos.get(t) })),
    /** Hace arrastrable otra ventana del mismo contenedor (la conversación de Dominus nostrum) */
    mover: hacerMovible,
  };
}
