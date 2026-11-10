/* Cerebro de demostración: respuestas de EJEMPLO, sin red, para probar
   el flujo completo (panel, conversación, citas, tiempo) en la tableta.
   Siempre cita fragmentos que existen y respeta la señal de aborto. */

const ESPERA = 3000;

function esperar(ms, senal) {
  return new Promise((ok, mal) => {
    let t = null;
    const abortado = () => { clearTimeout(t); mal(new DOMException('Consulta cancelada', 'AbortError')); };
    if (senal?.aborted) return abortado();
    t = setTimeout(() => { senal?.removeEventListener('abort', abortado); ok(); }, ms);
    senal?.addEventListener('abort', abortado, { once: true });
  });
}

export function respuestaDeEjemplo(fragmentos, mensajes) {
  const ns = fragmentos.map(f => f.n);
  const turno = mensajes.filter(m => m.rol === 'usuario').length;
  const pregunta = [...mensajes].reverse().find(m => m.rol === 'usuario')?.texto || '';
  const c = n => `[${n}]`;
  if (!ns.length) return 'Respuesta de ejemplo. No tengo fragmentos en esta conversación: busca primero y vuelve a preguntar.';
  if (turno <= 1)
    return `Respuesta de ejemplo. Sobre «${pregunta}»: lo que tienen en común ${c(ns[0])}${ns[1] ? ` y ${c(ns[1])}` : ''}, ` +
      `en qué se diferencian${ns[2] ? `, y cómo ${c(ns[2])} lo completa` : ''}. Si algo no está en ellos, lo digo en vez de suponerlo.`;
  const k = ns[(turno - 1) % ns.length];
  return `Respuesta de ejemplo (turno ${turno}). Siguiendo con lo que platicamos: sobre «${pregunta}», ${c(k)} lo aclara` +
    `${ns.length > 1 && k !== ns[0] ? `, y se relaciona con lo que te dije antes de ${c(ns[0])}` : ''}. ` +
    'Recuerdo toda esta conversación mientras el modo siga encendido.';
}

export default {
  id: 'demostracion',
  nombre: 'Demostración (simulado)',
  envia: false,
  aviso: 'No se envía nada: las respuestas son de ejemplo.',
  async responder({ fragmentos, mensajes, senal }) {
    await esperar(ESPERA, senal);
    return { texto: respuestaDeEjemplo(fragmentos, mensajes) };
  },
};
