/* ============================================================
   Paneles COLECCIÓN y SISTEMA (datos reales, en vivo).
   ============================================================ */
const $ = id => document.getElementById(id);

/** Cuándo, en lenguaje relativo: «ahora», «hace 15 min», «hoy 08:10», «ayer», «hace 5 días», fecha completa. */
export function hace(fecha, ahora = new Date()) {
  if (fecha == null || fecha === '') return '—';
  const d = new Date(fecha);
  if (isNaN(d)) return '—';
  const min = Math.round((ahora - d) / 6e4);
  const mismoDia = (a, b) => a.toDateString() === b.toDateString();
  if (min < 1) return 'ahora';
  if (min < 60) return 'hace ' + min + ' min';
  if (mismoDia(d, ahora)) return 'hoy ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const ayer = new Date(ahora); ayer.setDate(ahora.getDate() - 1);
  if (mismoDia(d, ayer)) return 'ayer';
  const dias = Math.floor((ahora - d) / 864e5);
  if (dias < 30) return 'hace ' + Math.max(2, dias) + ' días';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function crearTablero() {
  const barras = $('barras');
  for (let i = 0; i < 14; i++) barras.append(document.createElement('span'));
  let fechaDoc = null, acum = 0;

  const pintarDoc = () => { $('dDoc').textContent = hace(fechaDoc); };
  const reloj = () => {
    pintarDoc();
    $('dHora').textContent = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };
  reloj(); setInterval(reloj, 20000);

  return {
    /** Conjuntos (del informe guardado), fecha del documento y estado del índice */
    coleccion({ conjuntos = null, fecha = null } = {}) {
      $('dConjuntos').textContent = conjuntos ?? '—';
      fechaDoc = fecha; pintarDoc();
    },
    indice(texto) { $('dIndice').textContent = texto; },
    /** Ventanas abiertas: número y etiquetas L·23, S·87…, máximo 8 y luego «+N» */
    abiertas(lista) {
      $('dAbiertas').textContent = lista.length;
      const l = $('dLista'); l.innerHTML = '';
      if (!lista.length) { l.textContent = '—'; return; }
      lista.slice(0, 8).forEach(v => { const s = document.createElement('span'); s.textContent = v.corta; l.append(s); });
      if (lista.length > 8) { const s = document.createElement('span'); s.textContent = '+' + (lista.length - 8); l.append(s); }
    },
    /** Energía y barras al ritmo de Agios (llamar en cada cuadro) */
    cuadro(S, dT) {
      acum += dT; if (acum <= 90) return; acum = 0;
      $('dEnergia').textContent = Math.round(S.energy * 100) + '%';
      [...barras.children].forEach((b, i) => b.style.height =
        (8 + S.energy * (25 + 60 * Math.abs(Math.sin(S.T * .003 + i * .7)) * (.6 + .4 * Math.random())) * (S.mult / 1.5 + .33)) + '%');
    },
  };
}
