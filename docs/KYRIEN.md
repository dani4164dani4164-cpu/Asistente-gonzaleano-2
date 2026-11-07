# Kyrien: segunda colección (Doctrina Gonzaleana) + transición entre asistentes

Prototipos aprobados por el usuario (en ellos la búsqueda y la carga son
**simuladas**; en la app se usa el motor real que ya existe):

- `prototipo/kyrien/`: Kyrien (`kyrien-escena.js`) dentro de su interfaz arcana.
- `prototipo/transicion/`: la transición Agios ⇄ Kyrien (`transicion.js`) y el
  menú ☰ → Ajustes para elegir el estilo.

## 0. Regla de oro (igual que antes)

- **No se pierde nada de Agios.** No cambies el nombre de la base IndexedDB
  (`agios`), los almacenes ni la colección `lecturas`. Si hace falta un almacén
  o un índice nuevo, súbelo de versión con una migración en `onupgradeneeded`
  que **conserve todo** lo existente.
- Repite la prueba obligatoria de actualización: con la versión actual de
  `main` y Lecturas ya procesadas, actualiza y comprueba que Agios sigue
  funcionando sin volver a subir nada. El modelo tampoco se vuelve a descargar.
- El documento de la Doctrina, como el de las Lecturas, **nunca sale del
  dispositivo ni se sube al repositorio**.

## 1. Nueva colección

En `js/colecciones.js`:

```js
{ id:'doctrina', asistente:'Kyrien', subtitulo:'Doctrina Gonzaleana',
  nombre:'Doctrina Gonzaleana', escena:'kyrien', analizador:'doctrina', tema:'kyrien' }
```

Y a la de Agios agrégale `tema:'agios'`. El mismo motor (fragmentos, embeddings,
búsqueda exacta y por significado, lector, actualización incremental) sirve
para las dos colecciones. Cada colección tiene sus datos separados, y borrar
una no toca la otra.

## 2. Formato real del documento (verificado sobre el archivo del usuario)

`DOCTRINA_GONZALEANA_*.docx`: unos 5,200 párrafos y ~165,000 palabras, sin
tablas. Es el archivo que el usuario **actualiza con más frecuencia**, y casi
siempre **agrega en medio**, no al final.

**Importante: los estilos de Word NO son confiables aquí.** Algunos bloques
usan `heading 1` (ESTIGMAS, LOGOS, CRÓNICAS) y otros son texto normal
(CRISTOLOGÍA, MARIOLOGÍA, GONZALEANOLOGÍA, CREDO, TEOFANÍAS, NOVENARIOS).
CATEQUESIS es `heading 2`. Además, dentro de Catequesis algunos capítulos usan
`heading 1` («LOS MANDAMIENTOS», «LA SANTA MISA»…) aunque son capítulos y no
bloques. **El nivel se decide por el FORMATO visual**: tamaño de letra (del
run, o si no, del estilo), negrita y alineación. Los estilos de título solo
sirven de pista. Reglas que funcionan con el documento real (tamaño en
medios puntos, el atributo `w:sz`):

| Nivel | Cómo se reconoce | Ejemplos |
|---|---|---|
| **Bloque** | tamaño ≥ 60 (≥ 30 pt), centrado, con o sin negrita | `CRISTOLOGÍA GONZALEANA` (96), `GONZALEANOLOGÍA` (72), `ESTIGMAS` (120), `LOGOS` (120, sin negrita), `NOVENARIOS` (116) |
| **Parte** | negrita, centrado, empieza con `PARTE ` | `PARTE I._ “ENSEÑANZA HISTÓRICA”` (34) |
| **Capítulo** | negrita y centrado, tamaño 28–40. **Varias líneas seguidas así forman UN solo título** | `NUESTRO SEÑOR JESUCRISTO` + `“EL HIJO DE DIOS”`; `EL PECADO` + `"LA DESOBEDIENCIA A DIOS"` + `(PRIMERA COMUNIÓN)`; `CAPÍTULO I: “EL CAMINO MARCADO”` |
| **Sección** | (a) `heading 3`; o (b) párrafo corto (≤ 14 palabras) todo en negrita, justificado, que termina en `._` o va entre comillas | Logos: `Lunes 7 de Agosto de 2017:`; Crónicas: `“Te fallé”`; Estigmas: `FUNDAMENTO BÍBLICO._`; Gonzaleanología II: `“DESDE PEQUEÑO”` |

Con esas reglas, el documento actual da **11 bloques**, en este orden (es el
mismo orden que el documento enumera en su propia INTRODUCCIÓN):

1. DOCTRINA GONZALEANA (preliminares: Introducción y Prólogo)
2. CRISTOLOGÍA GONZALEANA: 6 capítulos
3. MARIOLOGÍA GONZALEANA: 4 capítulos
4. GONZALEANOLOGÍA: 6 capítulos (Parte I doctrinal y Parte II cronológica, con 18 secciones)
5. ESTIGMAS: Introducción, Prólogo, Capítulo I y Capítulo II, con secciones `…._`
6. CATEQUESIS GONZALEANA: ~25 capítulos (Cuaresma, Semana Santa, La Fe, Credo/Símbolo, Pecado, Mandamientos, Sacramentos, Misa, Eucaristía, Confesión, Oración, El Templo…)
7. CREDO GONZALEANO: 3 capítulos
8. TEOFANÍAS: Introducción, Prólogo y Capítulos I–II
9. LOGOS: Introducción, Prólogo y ~39 entradas fechadas
10. CRÓNICAS: Prólogo y ~63 crónicas tituladas entre comillas (algunas de más de 10,000 palabras)
11. NOVENARIOS: «Novenario 7 de Agosto…» y «Novenario 3 de Noviembre…»

Detalles a tolerar:
- Etiquetas de grupo dentro del título: `(PRIMERA COMUNIÓN)`, `(CONFIRMACIÓN)`.
  Guárdalas como dato del capítulo y muéstralas como etiqueta.
- Listas con viñetas o números (`numPr`) son texto normal, no títulos.
- El texto del Credo va en negrita y justificado, pero sus líneas NO son
  secciones: no terminan en `._` ni van entre comillas y son parte del cuerpo.
  Comprueba que el Credo quede como un capítulo con su texto completo.
- Mayúsculas y minúsculas mezcladas (`“El ELEGIDO”`), comillas tipográficas
  “ ” y rectas " ", acentos.
- Lo que no encaje en ninguna regla es cuerpo del nivel en que esté.

**Unidad de lectura y búsqueda:** la sección cuando existe; si no, el
capítulo. Las crónicas muy largas se dividen en fragmentos por párrafos, como
ya se hace, sin partir frases.

**Pantalla «Estructura detectada»** (adaptada a esta colección): número de
bloques, capítulos y secciones; el árbol plegable Bloque → Capítulo →
Sección; los títulos dudosos (por ejemplo, un párrafo grande en negrita que no
encajó); y las diferencias con la versión anterior (nuevas · modificadas ·
sin cambios · eliminadas).

## 3. Actualizaciones en medio del documento (clave para este usuario)

El usuario inserta texto **en medio**. Las posiciones cambian siempre, así que
**ninguna identidad debe depender de la posición**:

- Identidad de cada pieza: la **ruta de títulos normalizada** (bloque ›
  capítulo › sección), más un sufijo de ocurrencia solo si se repite el mismo
  título exacto dentro del mismo padre.
- Hash del contenido por pieza: si una pieza conserva su ruta y su hash, NO se
  reprocesa, aunque se haya movido.
- Si una pieza cambia de título pero su hash es igual, trátala como
  renombrada: conserva sus embeddings y actualiza la ruta.
- Solo se calculan embeddings de lo nuevo o modificado, y se borra lo eliminado.
- Prueba: inserta una sección nueva a mitad de Cristología y otra a mitad de
  Crónicas, y modifica un párrafo de Logos. Debe reprocesar solo esas 3 piezas.

## 4. Búsqueda en Kyrien

- Exacta y por significado, igual que en Agios.
- Referencias que el usuario escribirá: nombres de bloque (`Crónicas`,
  `Logos`, `Credo`), títulos de capítulo o de crónica (`Te fallé`, `El hijo de
  Dios`), fechas de Logos (`Logos 20 de septiembre de 2025`, `7 de agosto 2017`)
  y combinaciones (`Estigmas fundamento bíblico`). Acentos y comillas no importan.
- Etiquetas cortas para el panel «Abiertas»: `Crist`, `Mario`, `Gonz`,
  `Estig`, `Cateq`, `Credo`, `Teof`, `Logos`, `Crón`, `Nov`, `Prel`, seguidas
  del número de capítulo/sección o de la fecha corta (`Logos·20/09/25`).
- Ventanas: título = ruta corta (p. ej. «Crónicas · “Te fallé”»), tipo = nombre del bloque.

### Enlaces entre colecciones (muy valioso)

El texto de la Doctrina cita **215 veces** a las Lecturas (`(Lect. Gonz. 44)`,
`(Evang. Gonz. 12)`…) y 9 veces a `(Palabra del Señor, 20 de julio de 2024)`.

- En el lector y en las ventanas de Kyrien, convierte cada `Lect./Salmo/Evang.
  Gonz. N` en un enlace. Al tocarlo se abre esa pieza como **ventana de Agios**
  (con su estilo de cristal morado) encima de la interfaz de Kyrien, sin
  cambiar de asistente. Si la colección de Lecturas no está cargada, avisa con
  un mensaje breve.
- `(Palabra del Señor, fecha)`: enlaza a la entrada de Logos con esa fecha si
  existe; si no, muestra la cita tal cual.

## 5. Kyrien: modelo e interfaz

- `js/escenas/kyrien.js` = `prototipo/kyrien/kyrien-escena.js` sin cambiar su
  diseño. Mismo contrato que Agios, más:
  - `S.apertura` **en Kyrien significa «el hechizo se deshace»**. Al tocar 📎
    sube a 1: la roca estalla, el ojo desaparece y los anillos se rompen.
    **Durante el procesamiento real, la app lo baja de 1 a 0 según el avance**
    (`apertura = 1 − progreso`), así el hechizo se rearma al ritmo del
    proceso. Al cancelar, vuelve a 0 suavemente.
  - Buscar (`S.mult = 2`): el ojo se dilata y la pupila se enciende.
  - `invocar()` forma el círculo mágico con símbolos que salen de los anillos,
    y `puntoDeHechizo(i, n)` da dónde nace cada ventana. Si la escena tiene
    `invocar`, la app lo llama al mostrar resultados y espera ~1 s antes de
    lanzar las ventanas desde `puntoDeHechizo`. Si no lo tiene (Agios), sigue
    como hoy.
- **Temas por colección.** La interfaz de Kyrien es la de
  `prototipo/kyrien/index.html`: fondo sepia cálido con estrellas, Cinzel y
  Cormorant Garamond, esquinas con filigrana, esfera de numerales romanos,
  placas con doble filete, velitas en lugar de barras, ventanas y lector de
  pergamino, consola redondeada con ✦, y estados *dormido / despierto / aguarda
  un archivo / leyendo… / archivo recibido / buscando…*. Implementa los dos
  temas con una clase en `<body>` (`tema-agios` / `tema-kyrien`) y variables
  CSS. Las piezas propias de cada tema (retícula de Agios y esfera de
  numerales de Kyrien, fondos) van en capas que se funden.
- Panel COLECCIÓN en Kyrien: Bloques (11) · Abiertas (etiquetas) · Índice · Modo.
- Tipografías Cinzel y Cormorant Garamond alojadas en el repo (woff2 de
  `@fontsource`, con su licencia OFL) y en el service worker.

## 6. Cambiar de asistente y la transición

- **Selector** AGIOS | KYRIEN bajo la barra superior (ver prototipo). Recuerda
  la última colección elegida (localStorage con try/catch).
- **Transición** = `prototipo/transicion/transicion.js`, con la coreografía de
  `prototipo/transicion/index.html`:
  - **Implosión** (~7 s): el que se va gira y se encoge hacia su centro; luego
    fogonazo, onda expansiva en tres brazos, galaxia espiral que cambia de color
    mientras el mundo cambia de tema, y corrientes que dibujan al que llega,
    que se materializa (Kyrien rearmando su roca; Agios cerrando su núcleo).
  - **Estallido** (~6 s): el que se va estalla en partículas que viajan en
    remolino y dibujan al que llega.
  - Durante la transición el selector se bloquea, y no se pueden buscar ni
    subir archivos.
  - Las ventanas abiertas de la colección que se va se guardan y se restauran
    al volver a ella. Solo se ven las del asistente activo.
  - Solo se dibujan las escenas visibles; la oculta no gasta GPU.
  - Si el dispositivo no tiene WebGL 2, cambio directo con un fundido suave.
- **Menú ☰ → Ajustes → «Transición entre asistentes»**: Implosión (por
  defecto), Estallido o Al azar. Se guarda en localStorage. El panel de ajustes
  toma los colores del tema activo. Deja la sección de Ajustes lista para
  agregar más opciones después.

## 7. Verificación

- Genera un .docx **ficticio** con la misma estructura y los mismos formatos
  (tamaños, negritas, centrados, los estilos mezclados de la tabla de arriba,
  títulos de varias líneas, `(PRIMERA COMUNIÓN)`, Credo en negrita, Logos con
  fechas, Crónicas entre comillas y una muy larga) y **texto inventado**.
  Ningún documento real entra al repo.
- Pruebas: analizador (11 bloques en el ficticio que imita al real, árbol
  correcto, Credo completo); actualización con inserciones en medio (solo se
  reprocesan las piezas tocadas); búsqueda exacta y por significado;
  referencias de Logos por fecha; enlaces `Lect. Gonz. N` hacia Agios; ventanas
  que nacen del hechizo; rearmado al ritmo del avance; transición en ambos
  sentidos con los dos estilos y «Al azar»; ajustes guardados; ventanas
  restauradas al volver; **prueba de actualización sin pérdida de datos de
  Agios**; sin errores de consola; modo sin conexión.
- Capturas en celular y tableta comparadas con los prototipos.
- Commit en una rama nueva y pull request con resumen.

## 8. Menú de inicio: la nebulosa (prototipo: `prototipo/menu/`)

Al abrir la app ya **no** se entra directo a un asistente. Se muestra el menú:

- Arriba, en grande, **ANESTHIOS** en **platino azulado** (degradado metálico
  vertical blanco → platino → acero azulado, con un brillo azul suave; ver el
  prototipo) con «Asistentes Gonzaleanos» debajo, y abajo «ELIGE UN ASISTENTE».
- De fondo, la **nebulosa** de `prototipo/menu/nebulosa.js`: gas de colores
  (turquesa, azul, violeta, magenta, rosa, naranja, óxido), polvo cósmico que
  respira y estrellas con destellos en cruz.
- Un **orbe** por asistente, generado desde el registro de colecciones (nombre
  y subtítulo, con el color de su tema). Hoy son Agios y Kyrien; una colección
  nueva debe aparecer sola. Los orbes se acomodan para no encimarse en celular
  ni en tableta, vertical u horizontal.
- **Entrar = nacimiento estelar** (≈9 s, `formar()` de `prototipo/menu/nebulosa.js`):
  1. **Caos**: el polvo y el gas se agitan con turbulencia fuerte.
  2. **Acreción**: la materia entra en órbita y gira rápido en un disco
     inclinado alrededor de un centro de gravedad (más rápido cuanto más cerca
     del centro, ω ∝ r^-1.5). El disco se va cerrando y en el centro **crece un
     núcleo de luz** con la masa acumulada. La turbulencia se calma poco a poco.
  3. **Calma**: el giro se frena y la materia se acomoda en la forma del
     asistente (`FORMAS` de `transicion.js`, exportado). El núcleo cede su luz y
     el asistente se materializa (`S.apertura` de 1 a 0): Kyrien rearma su
     roca y Agios cierra su núcleo.
  La cámara de la nebulosa se encuadra sobre la zona del asistente
  (`encuadre(rect)`), para que el polvo forme la figura justo donde aparecerá.
  A la mitad cambia el mundo al tema del asistente.
- **Volver** (≈5 s): tocar **ANESTHIOS** en la barra superior. El asistente se
  deshace en polvo que **vuelve a ser la nebulosa**, el gas se enciende de
  nuevo y reaparece el menú. Las ventanas abiertas del asistente se guardan y
  se restauran al volver a entrar.
- Mientras se entra o se vuelve no se puede tocar nada más. Fuera del menú, la
  nebulosa deja de dibujarse (no gasta GPU).
- El selector AGIOS | KYRIEN dentro de la app sigue funcionando para cambiar
  directo entre asistentes, con Implosión o Estallido.
- Opcional en Ajustes: «Al abrir la app: mostrar el menú (por defecto) / entrar
  al último asistente usado».
- Sin WebGL 2: un menú estático con los orbes y un fundido simple.
- Verificación adicional: el menú al abrir, entrar a cada asistente, volver,
  entrar al otro, ventanas restauradas, y que una tercera colección ficticia
  añadida al registro aparezca como orbe sin tocar el menú.
