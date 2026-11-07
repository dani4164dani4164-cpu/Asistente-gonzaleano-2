# Cambios: de «Agios» a «Anesthios» + nueva interfaz

Prototipo aprobado por el usuario: `prototipo/anesthios/index.html` (usa
`prototipo/anesthios/agios-escena.js`, igual al modelo actual). En el
prototipo, la búsqueda y la carga son **simuladas**; en la app deben seguir
usando el motor real que ya existe. Este documento dice qué llevar a la app.

## 0. Regla de oro: NO perder los datos del usuario

El usuario ya procesó su documento real (371 conjuntos). Al actualizar, la
app **debe seguir funcionando con lo que ya tiene guardado, sin volver a
subir ni reprocesar nada**.

- **No cambies** el nombre de la base IndexedDB (`NOMBRE = 'agios'` en
  `js/db.js`), ni su `VERSION`, ni los almacenes ni sus claves, ni el `id`
  de la colección (`'lecturas'`). «Anesthios» es solo lo que se ve.
- No borres ni vacíes la caché del modelo de Hugging Face ni la de
  transformers.js. El service worker nuevo solo reemplaza la caché de la app.
- Si de verdad hiciera falta cambiar el esquema, súbelo de versión con una
  migración en `onupgradeneeded` que conserve todo. Mejor evitarlo.
- **Prueba obligatoria de actualización:** con la versión ACTUAL de `main`,
  procesa el documento de prueba; luego carga la versión nueva (mismo
  origen, service worker actualizado) y comprueba que sin subir nada:
  estructura, búsqueda exacta, búsqueda por significado y lector siguen
  funcionando, y que «Documento» muestra la fecha guardada.

## 1. Nombre de la app: Anesthios

- La **app** se llama **Anesthios**. **Agios** es el nombre del asistente de
  la colección de Lecturas y Evangelios.
- Cambia a «Anesthios»: `<title>`, `manifest.webmanifest` (`name`,
  `short_name`), README, y los textos que hablen de la app. Los textos que
  hablan del asistente («Toca a Agios para encenderlo», «Pídele a Agios…»)
  se quedan con Agios.
- En `js/colecciones.js` agrega a cada colección `asistente` (nombre del
  asistente) y `subtitulo`:
  `{ id:'lecturas', asistente:'Agios', subtitulo:'Lecturas y Evangelios', nombre:'Lecturas y Evangelios', escena:'agios', analizador:'lecturas' }`.
  La interfaz toma de ahí el título grande y el subtítulo, para que las
  colecciones futuras tengan su propio nombre.
- No cambies el nombre del repositorio ni las rutas: la app instalada debe
  seguir abriendo en la misma dirección.

## 2. Nueva interfaz (copiar del prototipo)

Respeta el aspecto del prototipo con fidelidad: colores, medidas,
animaciones y comportamiento en celular y tableta (vertical y horizontal).

- **Barra superior:** «ANESTHIOS» con «ASISTENTES GONZALEANOS» debajo, a la
  izquierda; a la derecha el chip de estado (punto de color: gris apagado,
  morado encendido, verde éxito, rojo error, que no se parta en dos líneas)
  y el botón ☰ con el menú que ya existe. Debajo, la regla con marcas.
- **Título del asistente** centrado arriba de la zona: «AGIOS» grande con
  el subtítulo y sus líneas; brilla encendido y se vuelve gris apagado.
- **Fondo y marco:** cuadrícula de puntos con viñeta, retícula detrás del
  modelo (aros, aro punteado y aro de marcas que giran muy lento, ejes y
  grados 000/090/180/270) y las cuatro esquinas del marco. Todo decorativo,
  sin capturar toques (pointer-events: none).
- **Panel COLECCIÓN** (abajo izquierda), con datos REALES:
  - Conjuntos: del informe de la colección guardada (hoy 371).
  - Abiertas: número de ventanas de resultado abiertas, y debajo etiquetas
    `L·23`, `S·87`, `E·24` (L = Lectura, S = Salmo, E = Evangelio) de las
    ventanas abiertas, en orden de apertura; máximo 8 y luego «+N».
    Se actualiza al abrir y cerrar ventanas.
  - Índice: estado real (● listo / indexando % / sin documento).
  - Modo: local.
- **Panel SISTEMA** (abajo derecha):
  - Energía: % de encendido, en vivo.
  - Documento: cuándo se subió/actualizó por última vez el documento, en
    lenguaje relativo («ahora», «hace 15 min», «hoy 08:10», «ayer»,
    «hace 5 días», y fecha completa pasado un mes). Debe salir de la fecha
    que YA está guardada en la colección (`colecciones.actualizado` o la
    fecha del documento guardado), así que funciona desde el primer momento
    con el documento que el usuario ya subió. «—» si no hay documento.
  - Hora: hora local (es-MX).
  - Barras animadas al ritmo de Agios (más altas a x2 y x3).
- **Consola inferior:** fila de sugerencias + campo con «›» y esquinas
  cortadas + 📎 y ➤. Sugerencias:
  - «✕ Cerrar todas» (solo cuando hay 2 o más ventanas abiertas).
  - Las últimas 3 búsquedas del usuario (guardadas en localStorage con
    try/catch); si aún no hay, ejemplos: «Evang. Gonz. 145», «salmo 87»,
    «la misericordia del Padre».
  - «☰ Índice», que abre el índice que ya existe.
- **Tipografías:** Rajdhani (títulos) y JetBrains Mono (datos). Deben
  funcionar **sin conexión**: alójalas en el repo (woff2, por ejemplo de los
  paquetes npm `@fontsource/rajdhani` y `@fontsource/jetbrains-mono`), con
  sus licencias (OFL) incluidas, y agrégalas al service worker.

## 3. Ventanas de resultado

- Cada ventana tiene su **✕** para cerrarla (con animación corta).
- **«✕ Cerrar todas»** en la fila de sugerencias cuando hay 2 o más.
- **Se acumulan:** una búsqueda nueva ya NO cierra las anteriores. Cada
  ventana nueva busca un hueco libre sin tapar las existentes; si ya no
  cabe, se acomoda en cascada. Las partículas que salen de los anillos
  vuelan hasta donde nacerá cada ventana (como ya hace la app).
- **Se pueden mover:** arrastrando desde su encabezado (con la marca ⋮⋮),
  con dedo y con mouse, sin salirse de la zona. La ventana que se toca pasa
  al frente. Arrastrar una ventana no debe girar a Agios ni encenderlo/apagarlo.
- Apagar a Agios cierra todas las ventanas. Subir un archivo ya no las cierra.
- Si el usuario busca algo que ya está abierto (misma pieza), no dupliques
  la ventana: tráela al frente y hazla destellar.

## 4. Verificación

- Ejecuta las pruebas existentes y amplía el e2e: nombre Anesthios, título
  del asistente, paneles con datos reales, ✕, cerrar todas, acumular
  (secuencia: buscar 23, cerrar su Salmo y Evangelio, buscar 24, cerrar los
  suyos → quedan solo L·23 y L·24 y el panel lo refleja), arrastrar sin
  girar al modelo, no duplicar, sugerencias recientes, y la **prueba de
  actualización sin pérdida de datos** del punto 0.
- Sin errores de consola; sube la versión de caché del service worker.
- Capturas en celular y tableta para comparar con el prototipo.
- Commit en una rama nueva y pull request con resumen.
