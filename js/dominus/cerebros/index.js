/* ============================================================
   Dominus nostrum — registro de cerebros (pieza intercambiable).

   Un cerebro es un módulo con este contrato:

     export default {
       id: 'demostracion',
       nombre: 'Demostración (simulado)',
       envia: false,      // true solo para un cerebro que use la red
       aviso: 'No se envía nada: las respuestas son de ejemplo.',
       async responder({ instruccion,            // texto fijo (instruccion.js)
                         fragmentos,             // [{n, ref, tipo, texto}]
                         mensajes,               // [{rol:'usuario'|'dominus', texto}]
                         senal }) {              // AbortSignal: si se aborta, se rechaza
         return { texto: '…con citas [1] [2]…' };
       },
     };

   Errores: throw new ErrorCerebro(tipo, mensaje), con tipo =
     'no-conectado' | 'limite' | 'red' | 'rechazo' | 'otro'
   Si `senal` se aborta, responder() debe rechazar con un error cuyo
   name sea 'AbortError' (la respuesta se descarta sin aviso).

   Hoy hay dos cerebros y NINGUNO usa la red:
     - 'sin-conectar' (por defecto): no responde y no envía nada.
     - 'demostracion': respuestas de ejemplo para probar el flujo.
   Conectar un cerebro real será agregar aquí su archivo (p. ej.
   'gemini': () => import('./gemini.js')) y su opción en Ajustes
   (AJUSTES en js/paneles.js). En el repositorio nunca habrá claves.
   ============================================================ */
export const CEREBROS = {
  'sin-conectar': () => import('./sin-conectar.js'),
  'demostracion': () => import('./demostracion.js'),
};
export const CEREBRO_POR_DEFECTO = 'sin-conectar';

export class ErrorCerebro extends Error {
  constructor(tipo, mensaje) {
    super(mensaje || tipo);
    this.name = 'ErrorCerebro';
    this.tipo = tipo;
  }
}

/** Carga el cerebro elegido (o el de por defecto si el id no existe). */
export async function cargarCerebro(id) {
  const cargar = CEREBROS[id] || CEREBROS[CEREBRO_POR_DEFECTO];
  return (await cargar()).default;
}
