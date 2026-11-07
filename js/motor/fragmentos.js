/* ============================================================
   Fragmentos para la búsqueda por significado y hash por pieza.
   Puro: sirve en el Worker y en las pruebas.
   ============================================================ */
import { contarPalabras, frasesConPosicion } from '../texto.js';

/**
 * Divide una pieza en fragmentos por párrafos, sin partir frases.
 * Las marcas (autor, cierres, «Canto», «Todos: …», «Aleluya») no entran.
 * → [{posicion, parrafoIni, parrafoFin, texto, desde?, hasta?}]
 *   desde/hasta: posición dentro del párrafo cuando un párrafo muy largo
 *   tuvo que repartirse en varios fragmentos (siempre entre frases).
 */
export function fragmentar(pieza, esMarca, { objetivoPalabras = 110, maximoPalabras = 200 } = {}) {
  const out = [];
  let buf = [], ini = -1, ult = -1, palabras = 0;
  const cerrar = () => {
    if (buf.length) out.push({ parrafoIni: ini, parrafoFin: ult, texto: buf.join('\n') });
    buf = []; ini = -1; palabras = 0;
  };
  pieza.parrafos.forEach((t, i) => {
    if (!t || esMarca(t)) return;
    const n = contarPalabras(t);
    if (n > maximoPalabras) {
      cerrar();
      // Párrafo muy largo: se reparte entre frases completas.
      let grupo = [], gp = 0;
      const soltar = () => {
        if (!grupo.length) return;
        const desde = grupo[0].ini, hasta = grupo[grupo.length - 1].fin;
        out.push({ parrafoIni: i, parrafoFin: i, texto: t.slice(desde, hasta), desde, hasta });
        grupo = []; gp = 0;
      };
      for (const f of frasesConPosicion(t)) {
        const nf = contarPalabras(f.texto);
        if (gp && gp + nf > maximoPalabras) soltar();
        grupo.push(f); gp += nf;
        if (gp >= objetivoPalabras) soltar();
      }
      soltar();
      return;
    }
    if (palabras && palabras + n > maximoPalabras) cerrar();
    if (ini < 0) ini = i;
    buf.push(t); ult = i; palabras += n;
    if (palabras >= objetivoPalabras) cerrar();
  });
  cerrar();
  return out.map((f, k) => ({ posicion: k, ...f }));
}

/** SHA-256 del contenido de una pieza (hex). */
export async function hashPieza(p) {
  const datos = new TextEncoder().encode(JSON.stringify([p.tipo, p.numero, p.titulo, p.apellido || '', p.parrafos]));
  const h = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
