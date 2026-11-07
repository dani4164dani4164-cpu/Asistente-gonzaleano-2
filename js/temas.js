/* ============================================================
   Temas: lo que cambia de un mundo a otro (además del CSS, que se
   activa con la clase tema-<tema> en <body>): cómo se nombran los
   estados del asistente y los textos de la consola.
   ============================================================ */
export const TEMAS = {
  agios: {
    estados: {
      apagado: 'apagado', activo: 'activo', esperando: 'esperando archivo', procesando: 'procesando',
      exito: 'archivo listo', error: 'no válido', buscando: 'buscando', transformando: 'transformando…',
    },
    tocar: n => `Toca a ${n} para encenderlo`,
    pedir: n => `Pídele a ${n} una lectura, un evangelio o una idea…`,
    procesando: n => `${n} está procesando tu documento…`,
  },
  kyrien: {
    estados: {
      apagado: 'dormido', activo: 'despierto', esperando: 'aguarda un archivo', procesando: 'leyendo…',
      exito: 'archivo recibido', error: 'no válido', buscando: 'buscando…', transformando: 'transformando…',
    },
    tocar: n => `Toca a ${n} para despertarlo`,
    pedir: n => `Pídele a ${n} un pasaje, un capítulo o una idea…`,
    procesando: n => `${n} está leyendo tu documento…`,
  },
};
export const tema = nombre => TEMAS[nombre] || TEMAS.agios;
