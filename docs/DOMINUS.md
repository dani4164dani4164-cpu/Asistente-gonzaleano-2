# Dominus nostrum: modo de cerebro externo (preparado, sin conectar todavía)

Prototipo aprobado por el usuario: `prototipo/dominus/` (`agios.html` y
`kyrien.html`; la lógica del modo está en `dominus.js` y los modelos con su
estado nuevo en `agios-escena.js` y `kyrien-escena.js`). En el prototipo la
búsqueda y las respuestas son **simuladas**.

**Qué se implementa ahora:** todo el funcionamiento del modo: comando,
temporizador, extensión, panel de confirmación, conversación, efectos
visuales y estados de los modelos.

**Qué NO se implementa ahora:** la conexión con una API (Gemini u otra). El
cerebro queda como una **pieza intercambiable** con dos versiones locales
(«Sin conectar» y «Demostración»). **Ninguna de las dos usa la red.** Conectar
un cerebro real será un trabajo aparte, que solo agregará un archivo nuevo en
`js/dominus/cerebros/` y su opción en Ajustes.

## 0. Reglas de oro (igual que siempre)

- **No se toca nada de los datos guardados.** Ni la base IndexedDB `agios`,
  ni su versión, ni sus almacenes, ni los ids de colección (`lecturas`,
  `doctrina`). Dominus nostrum **no guarda nada** en IndexedDB.
- **La conversación vive solo en memoria** (variables de JavaScript). Nunca
  en `localStorage`, `sessionStorage`, IndexedDB, caché ni service worker.
  Lo único que se guarda es el ajuste del cerebro elegido (sección 9).
- **Ningún documento sale del dispositivo.** En esta versión no sale nada en
  absoluto: ningún `fetch` ni conexión nueva. Compruébalo en las pruebas.
- **Prueba obligatoria de actualización:** con la versión actual de `main` y
  las dos colecciones ya procesadas, actualiza y comprueba que Agios y Kyrien
  siguen funcionando sin volver a subir nada.

## 1. Arquitectura

Módulos nuevos en `js/dominus/`:

| Archivo | Qué hace |
|---|---|
| `modo.js` | Interruptor del modo, temporizador, `/extender()`, reacción a los demás estados de la app |
| `conversacion.js` | Contexto en memoria (fragmentos numerados y mensajes), panel de confirmación, ventana de conversación |
| `efectos.js` | Lienzo 2D de rayos y aura encima de la escena; encogido y subida del asistente |
| `instruccion.js` | El texto fijo de instrucciones para el cerebro (sección 8) |
| `cerebros/index.js` | Registro de cerebros: `{ 'sin-conectar': () => import(...), 'demostracion': () => import(...) }` |
| `cerebros/sin-conectar.js` | Cerebro por defecto: no responde y no envía nada |
| `cerebros/demostracion.js` | Respuestas simuladas, como en el prototipo, para probar el flujo |

`app.js` solo debe: crear el modo con lo que necesita (asistente activo, `S`,
`meta`, escena, `poner`, `buscar`, ventanas, lector, `pista`), pasarle cada
envío de la consola antes de buscar, y avisarle cuando el asistente se apaga,
cambia de asistente o vuelve al menú.

Usa el prototipo como referencia de comportamiento. No copies su código de
simulación (el menú «Prototipo · simular» ni `respuestaSimulada` fuera de
`demostracion.js`), ni su aviso flotante: en la app los avisos van con la
`pista()` existente.

## 2. Comandos (se procesan en la consola, antes de buscar)

Orden en `$('form').onsubmit`:
1. **`/extender(n)`** → sección 4. Nunca se envía al cerebro.
2. **`/Dominus nostrum`** → enciende o apaga el modo (interruptor).
3. **Si el modo está encendido**, cualquier otro texto es una pregunta para
   Dominus nostrum (sección 5), no una búsqueda.
4. Si no, la búsqueda normal de siempre.

Los dos comandos son tolerantes a lo que haga el teclado del celular: se
comparan **sin acentos** y sin distinguir mayúsculas. Usa las expresiones del
prototipo (`RE_COMANDO`, `RE_EXTENDER`):
- Comando: `/Dominus nostrum`, `/ Domínus nostrum`, `Dominus noster`,
  `/dominus nostro` (la «/» es opcional).
- Extender: `/extender(5)`, `/Extender( 5 )`, `/extender 5`, `/extender(5 min)`
  (aquí la «/» **sí** es obligatoria, para no confundir una pregunta que empiece
  con «extender…»).

Con el asistente apagado, los comandos no hacen nada, salvo avisar «Primero
toca a {Asistente} para encenderlo».

Atajos en la barra de sugerencias, después de «Cerrar todas»:
- **✦ /Dominus nostrum**: hace lo mismo que el comando (enciende o apaga).
- **⏱ /extender(n)**: solo se ve con el modo encendido y extensión
  disponible. `n` = mín(5, minutos de extensión que quedan).

## 3. Encender, apagar y temporizador

- Al **encender**: duración de **5 minutos**, extensión disponible 10, la
  consola se limpia y queda lista para preguntar, el asistente da un destello
  platino y aparece la pista «Dominus nostrum activado · 5 min. Escribe el
  comando otra vez para apagarlo».
- El chip de estado muestra **«Dominus nostrum · m:ss»** con cuenta regresiva
  mientras el asistente está libre, y el texto del momento mientras prepara o
  consulta. Placeholder de la consola: «Pregúntale a Dominus nostrum sobre lo
  encontrado…», y con conversación abierta «Continúa la conversación…».
- Se **apaga** con:
  1. El comando otra vez (o el atajo ✦).
  2. El tiempo cumplido. Si en ese momento hay una consulta en curso, espera
     a que termine o falle, y luego se apaga.
  3. Apagar al asistente tocándolo, **cambiar de asistente** (AGIOS ⇄ KYRIEN)
     o **volver al menú**: se apaga de inmediato, antes de la transición.
- **Últimos 30 s:** el brillo late para avisar, y si hay conversación aparece
  en ella el aviso «Quedan 30 segundos. Al apagarse el modo, esta conversación
  se borra.» (una vez; vuelve a poder salir si se extiende).
- **Al apagarse se borra todo** (sección 6) y se avisa «Dominus nostrum
  desactivado · conversación borrada» (o «se desactivó (pasaron 5 minutos)…»).
- Usa el reloj real (`performance.now()` o `Date.now()`). Si la app vuelve
  del segundo plano con el tiempo vencido, se apaga al volver.

## 4. `/extender(n)`

- Suma `n` minutos al tiempo restante. **Máximo 10 minutos en total por cada
  activación**, repartidos como el usuario quiera (7 + 3, 10 de una vez…).
  Cada activación dura como máximo 15 minutos.
- Si pide más de lo que queda, suma solo lo disponible: «Solo quedaban 3 min
  de extensión. +3 min · quedan 14:59 · ya no se puede extender más».
- Sin extensión disponible: «Ya usaste los 10 min de extensión de esta
  activación». Sin número: «Escribe los minutos entre paréntesis, por ejemplo
  /extender(5)». Con el modo apagado: «Dominus nostrum no está activo…».
- Al extender: pequeño destello platino, pista con el tiempo restante y lo que
  queda de extensión, y si hay conversación una línea de aviso en ella.

## 5. Preguntar: fragmentos, confirmación y consulta

**Fragmentos = las ventanas de resultado abiertas del asistente activo.** De
cada ventana se toma su referencia, su tipo y **el texto del fragmento que
coincidió** (el pasaje que muestra la ventana, sin HTML), **nunca la pieza
completa ni el documento**. Cada fragmento enviado recibe un número **[n]**
que se pinta en su ventana (como en el prototipo) y que no cambia durante la
conversación. Los nuevos se numeran a partir del último.

Al enviar una pregunta con el modo encendido:
1. **Primera pregunta sin ventanas abiertas:** primero hace la búsqueda local
   normal con esa pregunta, espera sus ventanas y sigue al paso 2.
2. **Hay ventanas que todavía no se han enviado:** abre el **panel de
   confirmación** (diseño del prototipo). Muestra la pregunta y solo los
   fragmentos nuevos, cada uno con casilla para quitarlo, más una nota con
   cuántos fragmentos y palabras se enviarían, que el documento completo no
   sale, que responderá solo con lo que digan los fragmentos y qué cerebro
   está elegido (con su aviso de privacidad, sección 9). Botones
   **Cancelar** / **✦ Consultar**. Al cancelar no se envía nada y se quitan
   los números puestos.
3. **No hay fragmentos nuevos y la conversación ya tiene contexto:** consulta
   directo, sin panel.

Durante la consulta: estado «Dominus nostrum · consultando afuera», efectos
al máximo (sección 7), las ventanas de fragmentos se repliegan, y en la
conversación aparecen los puntitos de «escribiendo». Al terminar, el texto
del chip vuelve a la cuenta regresiva.

La consulta se hace con un `AbortController`. **Si el modo se apaga mientras
consulta, se aborta y la respuesta se descarta.**

## 6. Conversación (solo mientras el modo está encendido)

- La primera respuesta abre una **ventana de conversación** (estilo del tema:
  vidrio azul en Agios, pergamino en Kyrien). Burbujas: las del usuario a la
  derecha y las de Dominus nostrum a la izquierda. Errores y avisos van
  centrados.
- **Citas [n]** en las respuestas, como botones. Al tocarlas se abre ese
  fragmento en el **lector** de la app (su pieza, en ese pasaje).
- Encabezado «✦ Dominus nostrum · conversación», botón **–** para minimizar,
  y se puede arrastrar como las demás ventanas. Pie con «N fragmentos · M
  mensajes» y el botón **«Qué se ha enviado»**, que abre en el lector todo el
  contexto actual: la instrucción fija, los fragmentos y los mensajes.
- Se acomoda **abajo**, con la lista de mensajes de alto máximo
  `min(30vh, 260px)` y desplazamiento propio. Si el usuario la arrastró, no se
  vuelve a acomodar sola.
- **Mientras está abierta (no minimizada), las ventanas de fragmentos se
  quedan replegadas** (opacas al 0 %, escala 0.55 y sin recibir toques).
  Al minimizarla, vuelven.
- Si «Cerrar todas» cierra la conversación, la siguiente pregunta la vuelve a
  abrir con los mismos mensajes.
- **Contexto que se manda al cerebro en cada pregunta:** la instrucción fija,
  todos los fragmentos de la conversación y todos los mensajes anteriores.
  Si una consulta falla, esa pregunta no queda en el contexto.
- **Al apagarse el modo se borra todo:** la ventana de conversación (se cierra
  con su animación), los mensajes, los fragmentos, los números [n] de las
  ventanas y cualquier referencia. Debe quedar como si el modo nunca se
  hubiera encendido. Al volver a encenderlo empieza de cero.

## 7. Efectos visuales del modo (solo mientras está encendido)

Una intensidad `I` (0…1) se suaviza hacia su meta: **0.5** con el modo
encendido, **1** mientras consulta y **0** apagado. En los últimos 30 s, la
meta late entre 0.3 y 0.55.

**Cambios en las escenas** (cópialos exactos de `prototipo/dominus/` a
`js/escenas/agios.js` y `js/escenas/kyrien.js`: el resto de esos archivos es
idéntico a los actuales). Se agrega al contrato **`S.caos` (0…1)**:
- `errat(t, s)`: ruido errático (senos + sacudidas al azar) al ritmo acordado
  (t × 0.6, probabilidad de sacudida 0.021).
- **Agios:** el núcleo (y su caparazón y halo) tiembla y salta, y cambia de
  tamaño de golpe. Los anillos del giroscopio, los circuitos y el escáner se
  tambalean.
- **Kyrien:** la pupila se dilata mucho y se enciende. La roca y el ojo
  tiemblan juntos (el grupo `ojo`), y los trozos de roca vibran. Los anillos
  de hechizo (`incA`, `incB`, `incH`, `hexa`, `aro`, `corona`) se sacuden.
- `nuevoS()` en `app.js` debe incluir `caos: 0`. Con `caos = 0` todo queda
  exactamente como hoy.

**Desde el modo** (con `I > 0`):
- `S.caos = mín(1, I × 1.7)`.
- **Velocidad x3:** `meta.mult = 3` mientras el modo está encendido. Al
  apagarse, `poner()` la devuelve a la normal.
- **Brillo platino azulado:** `S.destello.color = #dbe6f7` con
  `k = máx(k, I × 0.78)` en Agios y `I × 0.72` en Kyrien.
- **Lienzo 2D** (`efectos.js`) encima de la escena, sin recibir toques. Lleva
  un aura radial que respira y **rayos que giran alrededor** del asistente,
  en órbitas elípticas inclinadas; la parte que pasa por detrás se ve más
  tenue:
  - **Agios: eléctricos.** Zigzag que se rehace cada 3 cuadros, con ramitas
    ocasionales y parpadeo. Colores `#ffffff`, `#e4edff`, `#bcd2f5`.
  - **Kyrien: mágicos.** Dos hebras suaves que se entrelazan, con cola que se
    desvanece y chispas que flotan desde la cabeza (algunas doradas
    `#ffe6b0`). Colores de hebra `#f4f8ff`, `#d3e1f8`, `#b9cdf0`.
  - Nacen más seguido mientras consulta. Giran al 60 % de la velocidad
    original.
- **Rendimiento (obligatorio; con esto se arregló el trabado en la tableta):**
  nada de `shadowBlur`. El resplandor se hace con trazos anchos
  semitransparentes. Máximo 10 rayos y 70 chispas. El lienzo usa como máximo
  `devicePixelRatio` 1.5. Un solo trazo por tramo, no por segmento.

**Encogido:** con la conversación abierta, el asistente (su capa), el
fondo del tema (retícula de Agios, esfera de numerales de Kyrien) y los rayos
se **encogen y suben** al espacio libre entre el título y la conversación:
`k = clamp((arriba − abajo)/(0.78 · mín(ancho, alto)), 0.42, 1)`, centrado en
ese espacio, con transición suave. Los rayos usan la misma transformación
(`proyectarVisible` del prototipo). Al minimizar o cerrar la conversación,
todo regresa.

**Arreglo necesario (el usuario lo detectó):** `layout()` en `app.js` mide
con `stage.getBoundingClientRect()`, que incluye el encogido. Si el teclado
abre o cierra mientras el asistente está encogido, todo queda descolocado.
**Usa `stage.clientWidth` / `stage.clientHeight`** (y para la nebulosa,
`encuadre`, lo que corresponda sin el encogido). Prueba: encoger, cambiar el
alto de la ventana, restaurarlo y minimizar. Los rayos deben quedar centrados
en el asistente.

## 8. Instrucción fija para el cerebro (`instruccion.js`)

Debe quedar lista aunque hoy no se envíe a ningún lado:

> Eres Dominus nostrum, el segundo cerebro de Anesthios. Respondes en español.
> Respondes **solo** con base en los fragmentos numerados que se te dan y en
> esta conversación; no uses conocimiento externo ni inventes doctrina. Cita
> cada idea con su número entre corchetes, por ejemplo [2]. Si la respuesta no
> está en los fragmentos, dilo claramente y sugiere buscar con otras palabras.
> No redactes textos nuevos de la doctrina: explica, relaciona y compara lo que
> los fragmentos dicen.

## 9. El cerebro intercambiable

Contrato (documéntalo en `cerebros/index.js`):

```js
export default {
  id: 'demostracion',
  nombre: 'Demostración (simulado)',
  envia: false,      // true solo para un cerebro que use la red
  aviso: 'No se envía nada: las respuestas son de ejemplo.',
  async responder({ instruccion, fragmentos /* [{n, ref, tipo, texto}] */,
                    mensajes /* [{rol:'usuario'|'dominus', texto}] */, senal /* AbortSignal */ }) {
    return { texto: '…con citas [1] [2]…' };
  },
};
// Errores: throw new ErrorCerebro(tipo, mensaje), con tipo =
// 'no-conectado' | 'limite' | 'red' | 'rechazo' | 'otro'
```

- **`sin-conectar` (por defecto):** al consultar lanza `'no-conectado'`. La
  conversación muestra el aviso «Dominus nostrum todavía no tiene un cerebro
  conectado. No se envió nada.», y en el panel de confirmación la nota dice
  «Cerebro: sin conectar — no se enviará nada».
- **`demostracion`:** responde tras ~3 s con textos de ejemplo como los del
  prototipo (primer turno y turnos siguientes, siempre con citas [n] válidas)
  y respeta `senal`. Así se prueba el flujo completo en la tableta.
- Mensajes de error en la conversación, ya preparados para el cerebro real:
  `limite` → «Se alcanzó el límite gratuito de hoy. La búsqueda local sigue
  funcionando.»; `red` → «Sin internet: no pude consultar…»; `rechazo` y
  `otro` → «No pude consultar. Intenta de nuevo más tarde.» Destello rojo en
  todos.
- **Ajuste nuevo en ☰ → Ajustes** (entrada en `AJUSTES` de `paneles.js`):
  clave `anesthios.dominus.cerebro`, «Cerebro de Dominus nostrum», opciones
  «Sin conectar» (defecto) y «Demostración (simulado)».
- **Reservado para después (no implementar):** el cerebro `gemini` llamará a
  un intermediario propio (Cloudflare Worker) que guarda la clave. En el repo
  nunca habrá claves. Su URL y contraseña se pedirán en Ajustes. Cuando
  exista, el texto de Privacidad del menú dirá que solo sale lo que el usuario
  confirma en Dominus nostrum. **Hoy ese texto no cambia**, porque no sale
  nada.

## 10. Pruebas antes del pull request

1. Actualización sin perder datos (sección 0), con Agios y Kyrien.
2. Comandos y variantes (con acento, mayúsculas, sin «/»). Una pregunta que
   empieza con «extender» no es comando.
3. Ciclo completo con **Demostración**: activar → preguntar sin ventanas
   (busca primero) → panel → conversación de 3 turnos sin panel →
   citas abren el lector. Además: con ventanas abiertas antes de activar, el
   panel las muestra; si después aparece una ventana nueva (por ejemplo desde
   un enlace), en la siguiente pregunta el panel muestra solo esa.
4. Con **Sin conectar**: el aviso aparece y no hay ninguna petición de red
   (revisa la pestaña de red en las herramientas del navegador).
5. Apagar por comando, por tiempo (acorta el tiempo solo en la prueba), por
   tocar al asistente, al cambiar AGIOS ⇄ KYRIEN y al volver al menú: no queda
   rastro de la conversación ni de los números [n]. Revisa que `localStorage`,
   `sessionStorage` e IndexedDB no tengan nada de Dominus (salvo el ajuste).
6. `/extender`: 7 + 5 → suma 3; luego ya no suma. Al reactivar se reinicia.
7. Encogido + cambio de alto de ventana (teclado) + minimizar: rayos
   centrados (sección 7).
8. Rendimiento: con el modo encendido, en un perfil de celular de gama media,
   que no se trabe (compara con el prototipo).
9. Con `caos = 0` los dos modelos se ven exactamente como antes.

Al terminar, abre un pull request con un resumen y cómo verificaste cada punto.
