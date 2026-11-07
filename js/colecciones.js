/* ============================================================
   Registro de colecciones.
   Cada colección define:
     id          identificador estable (se usa en IndexedDB)
     nombre      cómo se muestra
     escena      su modelo 3D, su «rostro»   → js/escenas/<escena>.js
     analizador  cómo leer su documento      → js/analizadores/<analizador>.js
   Para agregar «Doctrina», «Predicaciones», etc., añade una entrada aquí,
   su escena y su analizador (ver README, «Agregar una colección nueva»).
   ============================================================ */
export const COLECCIONES = [
  { id: 'lecturas', nombre: 'Lecturas y Evangelios', escena: 'agios', analizador: 'lecturas' },
];

export const coleccion = id => COLECCIONES.find(c => c.id === id) || null;
