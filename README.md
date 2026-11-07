# Anesthios

**Anesthios** es una web app instalable (PWA) de asistentes gonzaleanos. Su
primer asistente, **Agios**, sirve para **localizar, buscar y leer** las
Lecturas, Salmos y Evangelios Gonzaleanos a partir de tu propio documento de
Word (.docx).

Anesthios **nunca redacta, resume ni interpreta**: solo encuentra y muestra el
texto real del documento.

> **Privacidad.** Tu documento se lee y se guarda **solo en tu dispositivo**.
> Anesthios no envía su texto a ningún servidor: lo único que descarga de internet
> es la propia app, sus librerías y el modelo de búsqueda.
> **Los documentos jamás se suben a este repositorio**: el `.gitignore` bloquea
> `*.docx`, `*.doc`, `*.pdf`, `*.odt`, `*.rtf` y las carpetas `datos/` y
> `documentos/`. La única excepción es `pruebas/FICTICIO-documento-de-prueba.docx`,
> un documento de prueba con texto inventado.

## Qué hace

- **Lee tu .docx en el dispositivo** y reconoce cada conjunto: la Santa Lectura
  (Título 1), el Santo Salmo y el Santo Evangelio (Título 2), con su número
  escrito en palabras (`Ducentésima Quincuagésima Primera Santa Lectura` = 251).
- Te muestra la **Estructura detectada**: total de conjuntos, Lecturas, Salmos y
  Evangelios; números faltantes, repetidos o fuera de orden (por ejemplo, los
  conjuntos 89 a 94, que no tienen Evangelio); encabezados que no reconoció y
  una muestra del primer y del último conjunto.
- **Búsqueda exacta**: escribe una referencia (`Lect. Gonz. 145`,
  `Evang. Gonz. 145`, `Salmo Gonz. 87`, `lectura 12`, `evangelio 145`,
  `salmo 87`, `conjunto 300`, `octava lectura`) y va directo a la pieza; o una
  frase o palabras, sin importar acentos ni mayúsculas.
- **Búsqueda por significado**: escribe una idea con tus palabras
  («el pastor que busca a la oveja perdida») y encuentra los pasajes que hablan
  de eso aunque no usen las mismas palabras.
- Muestra de 2 a 5 resultados como ventanas que nacen de los anillos de Agios,
  con la parte que coincide resaltada y el botón **Ver completo**. Las ventanas
  **se acumulan** entre búsquedas (cada una busca un hueco libre), **se mueven**
  arrastrando su encabezado (⋮⋮), se cierran con **✕** o todas a la vez con
  **✕ Cerrar todas**, y si buscas una pieza que ya está abierta no se duplica:
  pasa al frente y destella. Apagar a Agios cierra todas.
- Paneles en vivo: **COLECCIÓN** (conjuntos, ventanas abiertas como `L·23`,
  `S·87`, `E·24`, estado del índice) y **SISTEMA** (energía, cuándo se subió el
  documento, hora). Bajo el campo de búsqueda, tus últimas 3 búsquedas y el
  acceso al **Índice**.
- **Lector** con la pieza entera, anterior/siguiente, saltos entre Lectura,
  Salmo y Evangelio del mismo conjunto, e **índice** por número.
- Funciona **sin internet** después de la primera carga.

## Actualizaciones de la app (tus datos se conservan)

Cuando se publica una versión nueva, la app se actualiza sola la próxima vez
que la abres (o en cuanto apagas a Agios / la mandas a segundo plano).
**No tienes que volver a subir ni procesar tu documento:** todo lo procesado
vive en la base IndexedDB `agios` del dispositivo, cuyo nombre, versión y
estructura no cambian entre versiones, y el modelo de búsqueda sigue en la
caché del navegador. El service worker solo reemplaza los archivos de la app.
(Por eso, aunque la app se llama Anesthios, algunos nombres internos siguen
diciendo «agios»: cambiarlos borraría lo que ya tienes guardado.)

## Cómo instalarla (tableta o celular)

1. Abre la dirección de la app en GitHub Pages
   (`https://<tu-usuario>.github.io/<este-repositorio>/`).
2. **iPad / iPhone (Safari):** botón Compartir → «Agregar a pantalla de inicio»
   (aparecerá como «Anesthios»).
   **Android (Chrome):** menú ⋮ → «Instalar app» o «Agregar a pantalla principal».
3. Ábrela desde el ícono. La primera vez necesita internet para guardar la app
   y descargar el modelo de búsqueda (~118 MB, una sola vez); después funciona
   sin conexión.

### Publicación (una sola vez, desde el navegador)

Anesthios se publica sola con GitHub Actions en cada cambio a la rama `main`
(`.github/workflows/pages.yml`). Solo hay que activarlo una vez:
en GitHub, **Settings → Pages → Build and deployment → Source: «GitHub Actions»**.
No hace falta ningún comando local.

## Cómo cargar tu documento

1. **Toca a Agios** para encenderlo (se ilumina; vuelve a tocarlo para apagarlo).
2. Toca **📎**: el núcleo se abre y aparece la ventana «Subir archivo».
3. Toca **Elegir archivo** y escoge tu .docx (desde Archivos, iCloud, Drive…).
4. Agios procesa el documento: gira más rápido y tiembla, y arriba a la derecha
   ves el avance (porcentaje y piezas procesadas). La pantalla no se apaga
   mientras tanto. Si cierras la app o se interrumpe, al volver **continúa donde
   se quedó**.
5. **Luz verde** = listo; se abre «Estructura detectada». **Luz roja** = el
   archivo no es un .docx o no se reconoció ninguna pieza (te dice por qué).

**Documento nuevo o actualizado:** súbelo igual con 📎. Agios calcula una huella
(hash) de cada pieza y **solo vuelve a procesar las nuevas o modificadas**; al
final te dice cuántas fueron nuevas, modificadas, sin cambios y eliminadas.

**Menú ☰:** documentos cargados, espacio usado, almacenamiento persistente,
«Estructura», «Índice» y **Borrar colección** (borra todo de este dispositivo).

### Qué formato espera

- Estilo **Título 1** (`heading 1`): `Primera Santa Lectura`, `Décima Primera
  Santa Lectura`, `Centésima Undécima Santa Lectura`…
- Estilo **Título 2** (`heading 2`): `Primer Santo Salmo`, `Segundo Santo Salmo
  de Súplica`, `Séptimo Santo Salmo Penitencial`, `Primer Santo Evangelio`,
  `Décimo Sexto Santo Evangelio de Jesucristo`…
- Un `INTRODUCCIÓN` en Título 1 al inicio se guarda como sección aparte
  (se puede leer y buscar, pero no cuenta como pieza).
- Tolera espacios sobrantes, femenino/masculino (`Primera`/`Primer`/`Primero`),
  `Décima Primera` y `Undécima`, acentos y mayúsculas. El estilo se reconoce por
  su nombre interno, así que da igual si tu Word está en español o en inglés.
- Las líneas de autor (`Escrita por el Profeta…`), los cierres (`Palabra del
  mismo Señor Jesucristo`…), `Canto`, `Todos: …` y `Aleluya, aleluya` se
  conservan al leer, pero no cuentan en la búsqueda por significado.

## Búsqueda por significado: el modelo

Se usa **`Xenova/multilingual-e5-small`** (versión ONNX de
`intfloat/multilingual-e5-small`) con **transformers.js 3.8.1** dentro de un
Web Worker, cuantizado a int8 (`q8`). Por qué este modelo:

- **Entiende bien el español:** está entrenado para búsqueda en ~100 idiomas y
  es de los modelos pequeños con mejores resultados de recuperación en español
  (MTEB multilingüe).
- **Es pequeño:** ~118 MB cuantizado, vectores de 384 dimensiones; corre en una
  tableta o un celular sin GPU y deja espacio de sobra en IndexedDB
  (~1.5 KB por fragmento).
- **Está hecho para buscar:** distingue consulta (`query:`) y pasaje
  (`passage:`), justo lo que necesita Agios: una pregunta corta contra párrafos.
- **Funciona sin internet:** se descarga una sola vez de Hugging Face y queda en
  la caché del navegador.

Alternativas descartadas: `paraphrase-multilingual-MiniLM-L12-v2` (tamaño
similar pero pensado para similitud de frases, no para recuperación),
`LaBSE` y `multilingual-e5-base` (3–4 veces más pesados para un celular).

Cada pieza se divide en fragmentos por párrafos (~110 palabras, máximo 200, sin
partir frases). La búsqueda exacta (frase y palabras, ponderadas por rareza) y
la búsqueda por significado se combinan en un solo ranking (fusión por rango
recíproco) y se muestran de 2 a 5 resultados.

## Agregar una colección nueva

Anesthios está organizado en **colecciones**. Cada una tiene su propio
asistente (nombre y subtítulo), su propio documento, su propio analizador y su
propio modelo 3D («rostro»). Para agregar, por ejemplo, «Doctrina»:

1. **Regístrala** en `js/colecciones.js` (el `id` no debe cambiar nunca
   después: es la clave de sus datos guardados):
   ```js
   { id: 'doctrina', asistente: 'Nombre del asistente', subtitulo: 'Doctrina',
     nombre: 'Doctrina', escena: 'doctrina', analizador: 'doctrina' },
   ```
   La interfaz toma de aquí el título grande y el subtítulo.
2. **Su analizador** en `js/analizadores/doctrina.js`, registrado en
   `js/analizadores/index.js`. Debe exportar (mira `lecturas.js` como modelo):
   - `TIPOS`: tipos de pieza `{ clave: { nombre, abrev, corto, orden } }`.
   - `analizar(parrafos)`: recibe `[{nivel, estilo, texto}]` y devuelve
     `{ piezas: [{tipo, numero, grupo, titulo, apellido, parrafos[], clave}], informe }`.
     El `informe` trae `ok`, `mensaje`, `resumen[]`, `avisos[]`, `muestra[]` y
     `datos` (la pantalla «Estructura detectada» lo pinta tal cual).
   - `esMarca(texto)` y opcionalmente `tipoDeMarca(texto)`: líneas que se
     muestran pero no entran a la búsqueda por significado.
   - `parsearReferencia(consulta)` → `{tipo, numero}` o `null`.
   - `etiqueta(pieza)` → `{ref, tipo}` para mostrarla.
3. **Su escena 3D** en `js/escenas/doctrina.js`, registrada en
   `js/escenas/index.js`. Exporta `{ id, nombre, crear(contenedor, S) }` y
   `crear` devuelve `{ redimensionar, dibujar, destruir, proyectar, puntoDeAnillo }`.
   Lee del estado compartido `S`: `energy`, `mult`, `apertura`, `temblor`,
   `destello` (mira `agios.js`).
4. Agrega los archivos nuevos a la lista `APP` de `sw.js` y sube `VERSION`
   (solo cambia el número: `agios-app-vN`).

Cuando hay más de una colección, el menú ☰ permite elegir cuál usar.

## Estructura del proyecto

```
index.html               interfaz (según prototipo/anesthios/), import map con versiones fijas
css/estilos.css, css/fuentes.css
fuentes/                 Rajdhani y JetBrains Mono (woff2 + licencias OFL), sin conexión
js/app.js                máquina de estados, coreografía, subir, buscar, menú
js/ventanas.js           ventanas de resultado: acumular, mover, ✕, no duplicar
js/tablero.js            paneles COLECCIÓN y SISTEMA
js/colecciones.js        registro de colecciones
js/escenas/agios.js      modelo 3D (three.js)
js/analizadores/         analizador «lecturas» (+ registro)
js/ordinales.js          ordinales en español ⇄ número (1–999)
js/docx.js               lectura del .docx (JSZip + DOMParser, nombres de estilo)
js/trabajador.js         Web Worker: análisis, hash, embeddings por lotes, búsqueda
js/motor/                fragmentos y buscador (exacta + significado + fusión)
js/db.js                 IndexedDB
js/lector.js, js/paneles.js
sw.js, manifest.webmanifest, iconos/
pruebas/                 pruebas unitarias en el navegador, generador y documento FICTICIO
pruebas/e2e/             prueba de extremo a extremo (solo desarrollo)
prototipo/               prototipos aprobados (Agios y Anesthios, referencia)
```

HTML, CSS y JavaScript puro con módulos ES: sin npm ni paso de compilación.
Librerías por CDN (jsDelivr) con versión fija: three 0.170.0, JSZip 3.10.1 y
@huggingface/transformers 3.8.1. Tipografías **Rajdhani** y **JetBrains Mono**
alojadas en `fuentes/` (de `@fontsource/rajdhani` y `@fontsource/jetbrains-mono`
5.3.0, licencia SIL Open Font License 1.1, ver `fuentes/LICENCIA-*.txt`).

## Pruebas

- **Desde la tableta:** abre `…/pruebas/` en la app publicada. Corre las pruebas
  del convertidor de ordinales (todos los ejemplos y ida y vuelta del 1 al 999),
  del analizador, de las marcas, de los fragmentos, de las referencias y de la
  búsqueda exacta. Ahí mismo puedes descargar el documento de prueba ficticio
  (y una «versión 2» para probar la actualización) y subirlo a Anesthios.
- **Extremo a extremo (desarrollo):** `pruebas/e2e/e2e.mjs` maneja Chromium con
  Playwright y recorre todo: **actualización desde la versión anterior sin
  perder datos**, interfaz (paneles, ventanas, sugerencias), errores con luz
  roja, procesamiento con interrupción y reanudación, Estructura detectada,
  búsquedas, lector, actualización incremental, uso sin conexión, borrado,
  privacidad y capturas en celular y tableta. Ver los comentarios del archivo.
