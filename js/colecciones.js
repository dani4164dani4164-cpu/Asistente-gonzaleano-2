/* ============================================================
   Registro de colecciones de Anesthios.
   Cada colección define:
     id          identificador estable (se usa en IndexedDB: NO cambiarlo,
                 o se perderían los datos ya guardados)
     asistente   nombre del asistente (título grande: «AGIOS»)
     subtitulo   lo que aparece bajo el nombre del asistente
     nombre      cómo se muestra en menús
     escena      su modelo 3D, su «rostro»   → js/escenas/<escena>.js
     analizador  cómo leer su documento      → js/analizadores/<analizador>.js
     tema        su mundo visual (clase tema-<tema> en <body>): 'agios' | 'kyrien'
   El menú de inicio dibuja un orbe por cada colección de esta lista.
   Para agregar «Doctrina», «Predicaciones», etc., añade una entrada aquí,
   su escena y su analizador (ver README, «Agregar una colección nueva»).
   ============================================================ */
export const COLECCIONES = [
  { id: 'lecturas', asistente: 'Agios', subtitulo: 'Lecturas y Evangelios', nombre: 'Lecturas y Evangelios', escena: 'agios', analizador: 'lecturas', tema: 'agios' },
  { id: 'doctrina', asistente: 'Kyrien', subtitulo: 'Doctrina Gonzaleana', nombre: 'Doctrina Gonzaleana', escena: 'kyrien', analizador: 'doctrina', tema: 'kyrien' },
];

export const coleccion = id => COLECCIONES.find(c => c.id === id) || null;
