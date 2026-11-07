# Agios — especificación

Agios es una web app instalable (PWA) para **localizar, buscar y leer** las
Lecturas, Salmos y Evangelios Gonzaleanos a partir del .docx del usuario.
El usuario trabaja solo desde tableta/celular: nada debe requerir comandos
locales. Publicación con GitHub Pages mediante GitHub Actions (rama `main`).

Agios **nunca redacta, resume ni interpreta**: solo encuentra y muestra el
texto real del documento.

## Punto de partida

En `prototipo/` está el prototipo aprobado:

- `index.html`: interfaz y máquina de estados.
- `agios-escena.js`: modelo 3D (three.js) con sus estados.

Respeta su diseño, su coreografía y su apariencia. Lo simulado (procesamiento
y búsqueda) es lo que hay que hacer real. Quita los botones "Simular…".

### Coreografía (conservar)

- Tocar a Agios: encender (color, velocidad normal) / apagar (gris, casi quieto).
- 📎: el núcleo se abre y aparece la ventana "Subir archivo".
- Al elegir archivo: la ventana se retrae, el núcleo se cierra, velocidad x3 y
  temblor ligero mientras procesa. Luz verde al terminar bien, roja si falla;
  luego vuelve a activo.
- Buscar: velocidad x2. Los resultados nacen como partículas que se
  desprenden de los anillos y se convierten en ventanas.

## Estructura del proyecto

- HTML/CSS/JS puro con módulos ES, sin npm ni paso de compilación.
  Librerías por CDN (jsDelivr) con versión fija en un import map.
- Arquitectura de **colecciones**: un registro donde cada colección define
  `id`, `nombre`, `escena` (su modelo 3D, su "rostro") y su `analizador` de
  documento. Por ahora una sola:
  `{ id: 'lecturas', nombre: 'Lecturas y Evangelios', escena: 'agios', analizador: 'lecturas' }`.
  Debe quedar listo para agregar después "Doctrina", "Predicaciones", etc.,
  cada una con su propio modelo 3D y su propio analizador.

## Formato real del documento (verificado sobre el archivo del usuario)

El documento se lee con JSZip + DOMParser sobre `word/document.xml`,
resolviendo el **nombre** de cada estilo desde `word/styles.xml` (no fiarse
del styleId, que puede variar según el idioma de Word).

- Unos 11,500 párrafos y ~300,000 palabras (más de 1,000 páginas). Crece con
  el tiempo: hoy tiene 371 conjuntos.
- Estilos usados: `heading 1`, `heading 2` y texto normal. Nada más.
- **No hay números en cifras: los números son ordinales escritos en palabras.**
- Estructura de cada conjunto N:
  - `heading 1`: la Santa Lectura. Ejemplos:
    `Primera Santa Lectura`, `Décima Primera Santa Lectura`,
    `Vigésima Santa Lectura`, `Centésima Undécima Santa Lectura`,
    `Ducentésima Quincuagésima Primera Santa Lectura`,
    `Tricentésima Septuagésima Primera Santa Lectura`.
  - `heading 2`: el Santo Salmo, en masculino, a veces con apellido:
    `Primer Santo Salmo`, `Segundo Santo Salmo de Súplica`,
    `Sexto Santo Salmo de Penitencia`, `Séptimo Santo Salmo Penitencial`,
    `Tricentésimo Septuagésimo Primer Santo Salmo`.
    Guarda el apellido ("de Súplica", "de Penitencia", "Penitencial") como dato.
  - `heading 2`: el Santo Evangelio, en masculino:
    `Primer Santo Evangelio`, `Décimo Sexto Santo Evangelio de Jesucristo`.
- Variantes que el analizador debe tolerar:
  - Espacios sobrantes al inicio o al final del encabezado.
  - Femenino y masculino (`Primera`/`Primer`/`Primero`, `Tercera`/`Tercer`).
  - Dos formas para 11 y 12: `Décima Primera` (en los primeros conjuntos) y
    `Undécima`/`Duodécima` (p. ej. `Centésima Undécima`). Ambas valen.
  - Acentos y mayúsculas.
  - Implementa un convertidor de ordinales en español a número (unidades,
    decenas `décimo…nonagésimo`, centenas `centésimo…`, incluidos
    `cuadringentésimo` y siguientes para cuando el documento siga creciendo)
    y valídalo contra todos los ejemplos de arriba.
- Hay un `heading 1` inicial `INTRODUCCIÓN` que no es un conjunto: guárdalo
  como sección aparte, consultable y legible, pero que no cuente como pieza.
- **Conjuntos sin Evangelio:** hoy los conjuntos 89 a 94 tienen Lectura y
  Salmo pero no Evangelio. Es un hueco real del documento, no un error del
  analizador: debe aceptarse sin fallar y reportarse en "Estructura detectada".
- Marcas frecuentes dentro del texto (sirven como metadatos y para que no
  dominen la búsqueda por significado):
  - Línea de autor al inicio de las piezas: `Escrita por el Profeta San Gonzalo
    Pío de San Miguel` / `Escrito por el Profeta San Gonzalo Pío de San Miguel`.
  - Cierres: `Palabra del mismo Señor Jesucristo`, `Palabra del mismo Señor Jesús`,
    `Palabras del mismo Señor Jesucristo`.
  - En los Salmos, líneas `Canto` y respuestas `Todos: …`; también `Aleluya, aleluya`.
  Consérvalas al mostrar el texto completo; exclúyelas o dales poco peso al
  crear los fragmentos para la búsqueda por significado.

Referencias que el usuario escribirá para pedir una pieza concreta:
`Lect. Gonz. 145`, `Evang. Gonz. 145`, `Salmo Gonz. 87`, `lectura 12`,
`evangelio 145`, `salmo 87`, `conjunto 300`, y también en palabras
(`octava lectura`).

### Pantalla "Estructura detectada"

Tras procesar, mostrar: total de conjuntos, Lecturas, Salmos y Evangelios;
números faltantes, repetidos o fuera de orden; encabezados que no se
reconocieron; y una muestra (primer y último conjunto). Si no se reconoce
ninguna pieza → luz roja y mensaje claro.

## Búsqueda

1. **Exacta**: las referencias van directo a la pieza. Búsqueda de frases y
   palabras sin importar acentos ni mayúsculas.
2. **Por significado**: embeddings en el dispositivo con transformers.js
   (`@huggingface/transformers`) dentro de un Web Worker, con un modelo
   multilingüe pequeño y cuantizado que entienda bien español (elige uno y
   justifica la elección en el README). Se descarga una vez y queda en caché
   para funcionar sin internet.

- Divide cada pieza en fragmentos de tamaño razonable (por párrafos, sin
  partir frases); cada fragmento guarda colección, tipo, número y posición.
- Combina ambas búsquedas en un solo ranking. Muestra de 2 a 5 resultados como
  ventanas: referencia, tipo, el fragmento que coincide (con la parte
  relevante resaltada) y "Ver completo".
- "Ver completo" abre un lector con la pieza entera, con botones para ir a la
  pieza anterior/siguiente y saltar entre Lectura, Salmo y Evangelio del mismo
  conjunto. También un índice para navegar por número.

## Documentos grandes

- Procesa por lotes en el Worker sin congelar la interfaz; muestra el avance
  (porcentaje y piezas procesadas) en el estado de Agios mientras tiembla a x3.
- Screen Wake Lock API para que la pantalla no se apague. Si se interrumpe,
  al volver debe continuar donde se quedó.
- Actualizaciones: al subir una versión nueva del mismo documento, calcula un
  hash por pieza y solo vuelve a procesar las nuevas o modificadas.
- Todo en IndexedDB; pide almacenamiento persistente
  (`navigator.storage.persist()`). Menú con: documentos cargados, espacio
  usado y borrar una colección.

## Privacidad (obligatorio)

- Los documentos y su contenido **nunca salen del dispositivo**: ninguna
  petición de red con su texto. Solo se descargan la app, las librerías y el modelo.
- El `.gitignore` ya bloquea `*.docx`, `*.doc`, `*.pdf` y carpetas de datos:
  no lo debilites. Aviso en el README: los documentos jamás se suben al repo.

## PWA

Manifest (nombre "Agios", fondo `#07070d`), íconos propios inspirados en el
modelo (diseño original), service worker con caché versionada para uso sin
conexión, y workflow de GitHub Pages. Rutas relativas.

## Verificación

- Genera un .docx de prueba con **esta misma estructura** (encabezados reales
  como los de arriba, texto inventado), con algún conjunto sin Evangelio y
  variantes de espacios/acentos. No subas ningún .docx real; el de prueba,
  si se versiona, en una carpeta de pruebas claramente marcada y con una
  excepción explícita en `.gitignore` solo para ese archivo.
- Prueba: procesar, estructura detectada, convertidor de ordinales, búsqueda
  exacta, por significado, lector, actualización incremental, uso sin
  conexión y errores (archivo no .docx o sin estructura = luz roja).
- README en español: qué hace, cómo instalarla, cómo cargar el documento y
  cómo agregar una colección nueva.
- Commit en una rama nueva y pull request con un resumen.
