/* ============================================================
   IndexedDB: todo lo que Agios guarda vive en el dispositivo.
   Lo usan la página y el Worker.

   Almacenes
     colecciones  {id, documento, informe, estado, modelo, actualizado}
     piezas       {id, coleccion, clave, tipo, numero, grupo, titulo,
                   apellido, autor, cierre, parrafos[], hash, orden}
     fragmentos   {id, coleccion, pieza, tipo, numero, posicion,
                   parrafoIni, parrafoFin, texto, vector, modelo, pend}
                  `pend` existe solo mientras falta su embedding
                  (índice disperso: así se reanuda donde se quedó).
     trabajos     {coleccion, archivo, nombre, ...} documento en curso,
                  para poder reanudar si se interrumpe la lectura.
   ============================================================ */
const NOMBRE = 'agios';
const VERSION = 1;

let abierta = null;
export function abrir() {
  if (abierta) return abierta;
  abierta = new Promise((ok, mal) => {
    const r = indexedDB.open(NOMBRE, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('colecciones')) db.createObjectStore('colecciones', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('piezas')) {
        const s = db.createObjectStore('piezas', { keyPath: 'id' });
        s.createIndex('coleccion', 'coleccion');
      }
      if (!db.objectStoreNames.contains('fragmentos')) {
        const s = db.createObjectStore('fragmentos', { keyPath: 'id' });
        s.createIndex('coleccion', 'coleccion');
        s.createIndex('pieza', 'pieza');
        s.createIndex('pend', 'pend');
      }
      if (!db.objectStoreNames.contains('trabajos')) db.createObjectStore('trabajos', { keyPath: 'coleccion' });
    };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => { db.close(); abierta = null; };
      ok(db);
    };
    r.onerror = () => mal(r.error);
    r.onblocked = () => mal(new Error('La base de datos está bloqueada por otra pestaña de Agios.'));
  });
  return abierta;
}

const prom = req => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });
const fin = tx => new Promise((ok, mal) => { tx.oncomplete = () => ok(); tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error || new Error('Transacción abortada')); });

export async function obtener(almacen, clave) {
  const db = await abrir();
  return prom(db.transaction(almacen).objectStore(almacen).get(clave));
}
export async function guardar(almacen, valor) {
  const db = await abrir();
  const tx = db.transaction(almacen, 'readwrite');
  tx.objectStore(almacen).put(valor);
  return fin(tx);
}
export async function borrar(almacen, clave) {
  const db = await abrir();
  const tx = db.transaction(almacen, 'readwrite');
  tx.objectStore(almacen).delete(clave);
  return fin(tx);
}
export async function todos(almacen, indice, clave) {
  const db = await abrir();
  const s = db.transaction(almacen).objectStore(almacen);
  return prom(indice ? s.index(indice).getAll(clave) : s.getAll());
}
export async function contar(almacen, indice, clave) {
  const db = await abrir();
  const s = db.transaction(almacen).objectStore(almacen);
  return prom(indice ? s.index(indice).count(clave) : s.count());
}
export async function clavesPorIndice(almacen, indice, clave) {
  const db = await abrir();
  return prom(db.transaction(almacen).objectStore(almacen).index(indice).getAllKeys(clave));
}

/** Ejecuta `fn(stores)` dentro de una transacción de escritura sobre varios almacenes. */
export async function escribir(almacenes, fn) {
  const db = await abrir();
  const tx = db.transaction(almacenes, 'readwrite');
  const stores = Object.fromEntries(almacenes.map(a => [a, tx.objectStore(a)]));
  fn(stores);
  return fin(tx);
}

/** Borra todo lo de una colección (documento, piezas, fragmentos y trabajo pendiente). */
export async function borrarColeccion(id) {
  const [piezas, frags] = await Promise.all([
    clavesPorIndice('piezas', 'coleccion', id),
    clavesPorIndice('fragmentos', 'coleccion', id),
  ]);
  await escribir(['colecciones', 'piezas', 'fragmentos', 'trabajos'], s => {
    s.colecciones.delete(id);
    s.trabajos.delete(id);
    piezas.forEach(k => s.piezas.delete(k));
    frags.forEach(k => s.fragmentos.delete(k));
  });
}
