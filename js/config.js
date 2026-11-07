/* ============================================================
   Configuración compartida por la página y el Worker.
   Las versiones de las librerías están fijas. Las de la página
   viven en el import map de index.html; el Worker no puede usar
   import maps, por eso su URL completa está aquí. Si cambias una
   versión, cámbiala también en sw.js (lista de precarga).
   ============================================================ */
export const URL_TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';

/* Modelo de embeddings (ver README, «Búsqueda por significado»). */
export const MODELO = {
  id: 'Xenova/multilingual-e5-small',
  dtype: 'q8',              // cuantizado int8: ~118 MB, se descarga una sola vez
  dimensiones: 384,
  prefijoConsulta: 'query: ',
  prefijoPasaje: 'passage: ',
};

/* Fragmentos para la búsqueda por significado */
export const FRAGMENTOS = { objetivoPalabras: 110, maximoPalabras: 200 };

/* Cuántos fragmentos se calculan por lote en el Worker */
export const LOTE = 8;
