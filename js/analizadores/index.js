/* Analizadores de documento disponibles. Sirve en la página y en el Worker. */
export const ANALIZADORES = {
  lecturas: () => import('./lecturas.js'),
  doctrina: () => import('./doctrina.js'),
};
export async function cargarAnalizador(nombre) {
  const f = ANALIZADORES[nombre];
  if (!f) throw new Error('Analizador desconocido: ' + nombre);
  return f();
}
