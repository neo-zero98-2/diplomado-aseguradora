# SPEC 05 — Chat con IA Gemini para que el asegurador consulte los accidentes

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02, SPEC 03, SPEC 04
> **Date:** 2026-10-03
> **Objective:** Agregar en `/home` un chat flotante de solo lectura donde el asegurador le pregunta a Gemini por los accidentes (cuántos hay en cada estado, a quién pertenecen y sus detalles), y Gemini responde con datos que el backend consulta en Supabase mediante function calling.

## Por qué existe esta spec

La SPEC 04 le dio al asegurador una tabla con filtro y búsqueda, pero responder preguntas como "¿cuántos accidentes graves siguen pendientes?" o "¿qué accidentes tiene Juan Pérez?" obliga a filtrar y contar a mano. El chat de Gemini para el asegurador se pidió junto con la SPEC 04 y se separó aquí porque consulta los estados y los datos que esa spec define. Gemini no cuenta ni busca por su cuenta: llama herramientas del backend que calculan los resultados exactos, y solo redacta la respuesta.

## Scope

**In:**

- `POST /accidentes/consulta` (asegurador): un turno del chat. El navegador manda el historial completo y el backend responde con el mensaje de Gemini y la lista de accidentes que menciona.
- Function calling de Gemini con tres herramientas de solo lectura: `contar_accidentes`, `buscar_accidentes` y `detalle_accidente`, más la herramienta de cierre `responder`.
- `GET /accidentes/:id` (asegurador): un accidente con el formato `AccidenteAsegurador`, para abrir el detalle desde el chat.
- Chat del asegurador en un botón flotante en la esquina inferior derecha de `/home`, con el mismo panel de la SPEC 04 (cruz para cerrar, pantalla completa en móvil).
- Al abrirse, el chat muestra un saludo fijo y tres preguntas sugeridas clicables, sin llamar a Gemini.
- Debajo de cada respuesta, la lista de accidentes mencionados con el botón "Ver", que abre el `DetalleAccidenteDialog` de la SPEC 04. Guardar un cambio desde ahí recarga la tabla de accidentes.
- Botón "Nueva conversación" en el encabezado del chat, que vuelve al saludo y a las sugerencias.
- Preguntas fuera de tema (lo que no trate de accidentes o de sus asegurados): Gemini responde amablemente que solo ayuda con eso.
- `ChatFlotante` se vuelve genérico para servir a los dos chats, sin cambiar el comportamiento del chat del asegurado.

**Out of scope (for future specs):**

- Que el chat cambie el estado, la nota o elimine accidentes (sigue haciéndose desde la tabla y el detalle de la SPEC 04).
- Consultas sobre asegurados sin accidentes (cuántos asegurados hay, pólizas vencidas, etc.).
- Mostrar la foto del accidente en el chat o mandarla a Gemini.
- Markdown, tablas o gráficas en las respuestas.
- Guardar los mensajes del chat en una tabla o reanudar la conversación después de recargar.
- Respuestas en streaming.
- Que Gemini genere SQL.
- Chat por voz.

## Data model

Esta spec **no agrega tablas ni columnas**. Lee `accidentes`, `asegurados` y `aseguradores` con la misma consulta de `AccidentesAseguradorService.listar()` de la SPEC 04.

Contratos de la API (backend `src/accidentes/`, frontend `src/accidentes/types.ts`):

```ts
// Body de POST /accidentes/consulta
interface ConsultaAseguradorDto {
  mensajes: { rol: 'usuario' | 'asistente'; texto: string }[]; // 1 a 40 mensajes, 2000 caracteres cada uno; el último es del usuario
  zonaHoraria: string;          // IANA del navegador, p. ej. 'America/Mexico_City'
}

// Respuesta de POST /accidentes/consulta
interface RespuestaConsulta {
  mensaje: string;                    // texto plano, sin Markdown
  accidentes: AccidenteMencionado[];  // máx. 10; vacío si no menciona accidentes concretos
}

// Lo arma el backend desde la base de datos, no desde lo que escribe Gemini
interface AccidenteMencionado {
  id: string;
  aseguradoNombre: string;
  vehiculoPlacas: string;
  estado: EstadoAccidente;
  gravedad: 'leve' | 'moderado' | 'grave';
  fechaHoraAccidente: string;         // ISO 8601
}

// Respuesta de GET /accidentes/:id
type AccidenteAsegurador; // el mismo de la SPEC 04
```

Herramientas que se declaran a Gemini (`src/accidentes/herramientas-asegurador.ts`):

```ts
// Filtros comunes; las fechas son 'YYYY-MM-DD' y filtran por fecha_hora_accidente
// en la zona horaria del navegador, con `hasta` incluido
interface FiltrosAccidentes {
  estado?: EstadoAccidente;
  gravedad?: 'leve' | 'moderado' | 'grave';
  desde?: string;
  hasta?: string;
  texto?: string;   // nombre del asegurado, idContrato o placas; sin distinguir mayúsculas ni acentos
}

// contar_accidentes(FiltrosAccidentes sin estado)
//   -> { total: number; porEstado: Record<EstadoAccidente, number> }

// buscar_accidentes(FiltrosAccidentes & { limite?: number })   // limite de 1 a 20, por defecto 10
//   -> { total: number;                 // coincidencias antes del límite
//        accidentes: {
//          id, estado, gravedad, fechaHoraAccidente, fechaReporte,
//          vehiculoMarca, vehiculoModelo, vehiculoPlacas,
//          asegurado: { nombre, idContrato }
//        }[] }                          // ordenados por fechaReporte descendente

// detalle_accidente({ id: string })
//   -> AccidenteAsegurador completo (sin la foto)  |  { error: 'No existe un accidente con ese id' }

// responder({ mensaje: string; accidentesIds: string[] })
//   -> cierra el turno; su contenido es la respuesta al asegurador
```

Códigos de respuesta:

| Caso | Código |
| --- | --- |
| Sin token o token inválido/expirado | 401 |
| `POST /accidentes/consulta` o `GET /accidentes/:id` con token de un asegurado | 403 |
| Body inválido (sin mensajes, más de 40, mensaje de más de 2000 caracteres, último mensaje que no es del usuario, zona horaria inválida) | 400 |
| `:id` sin formato UUID | 400 |
| `GET /accidentes/:id` con un id que no existe | 404 |
| Falta `GEMINI_API_KEY` o `GEMINI_MODEL` en el `.env` | 503 |
| Gemini falla, no responde o pasa de 5 rondas de herramientas sin llamar a `responder` | 502 |
| `POST /accidentes/consulta` exitoso | 200 |

Conventions:

- La conversación vive solo en el estado del componente del chat, como en la SPEC 03. El backend no guarda mensajes.
- El saludo fijo y las preguntas sugeridas no se mandan en el historial. La conversación que recibe Gemini siempre empieza con un mensaje del usuario.
- En cada turno, el backend carga la lista de accidentes una sola vez (la primera vez que Gemini llama una herramienta) y todas las herramientas del turno filtran y cuentan sobre esa misma lista en memoria.
- Gemini está obligado a llamar herramientas (`functionCallingConfig.mode = 'ANY'`): termina el turno llamando a `responder`. Máximo 5 rondas por turno.
- De `accidentesIds`, el backend descarta los ids que no existen, quita los repetidos y conserva los primeros 10.
- Las instrucciones viven en `src/accidentes/prompt-asegurador.ts` e incluyen la fecha y hora actual en la zona horaria del navegador, para entender "hoy" o "esta semana". Piden: responder en español y en texto plano, no inventar datos y obtener cualquier dato o conteo con las herramientas, rechazar amablemente lo que no sea de accidentes o sus asegurados, y explicar que los cambios de estado se hacen desde "Ver".
- Preguntas sugeridas: "¿Cuántos accidentes hay pendientes?", "Resumen de accidentes por estado" y "Accidentes graves de esta semana". Al hacer clic se mandan como mensaje del usuario.
- Cerrar el panel solo lo oculta: la conversación se conserva hasta recargar la página o hasta pulsar "Nueva conversación".
- Los elementos de la lista de accidentes mencionados muestran nombre del asegurado, placas, fecha `DD/MM/YYYY HH:mm` y el `Chip` de estado de `src/accidentes/estados.ts`.

## Implementation plan

1. Backend: agregar `obtener(id)` a `AccidentesAseguradorService` y `GET /accidentes/:id` (con `ParseUUIDPipe`) a `AccidentesAseguradorController`, con 404 si no existe. Confirmar que `AccidentesController` sigue antes en `controllers` de `AccidentesModule`, para que `GET /accidentes/mios` no caiga en `:id`. Pruebas unitarias: obtener existente y obtener inexistente → 404.
2. Backend: crear `src/accidentes/herramientas-asegurador.ts` con las declaraciones de las cuatro herramientas y las funciones puras `contarAccidentes()`, `buscarAccidentes()` y `detalleAccidente()`, que reciben la lista de `AccidenteAsegurador`, los argumentos y la zona horaria. Validan los argumentos (estado, gravedad, fechas y límite inválidos devuelven `{ error }` a Gemini en lugar de lanzar). Pruebas: conteo por estado, filtros de gravedad y de fechas en la zona horaria, búsqueda por nombre con acentos, por `idContrato` y por placas, límite y total, id inexistente.
3. Backend: agregar a `GeminiService` el método `conversarConHerramientas({ instrucciones, mensajes, herramientas, ejecutar, maxRondas })`. Llama a Gemini con `tools` y `mode: 'ANY'`; por cada llamada a una herramienta ejecuta `ejecutar(nombre, args)` y agrega la llamada y su resultado a los contenidos; al recibir `responder` devuelve sus argumentos. Si pasa de `maxRondas`, responde 502. Pruebas con `generateContent` simulado: una consulta y luego `responder`, `responder` directo y exceso de rondas → 502.
4. Backend: crear `src/accidentes/prompt-asegurador.ts`, `dto/consulta-asegurador.dto.ts` (con class-validator; la zona horaria se valida con `Intl.DateTimeFormat`) y `consulta-asegurador.service.ts`, y `POST /accidentes/consulta` con `@HttpCode(200)` en `AccidentesAseguradorController`. El servicio carga la lista de forma perezosa una vez por turno, ejecuta las herramientas, valida la respuesta de `responder` (mensaje no vacío) y arma `AccidenteMencionado[]` desde la lista. Registrar el servicio en `AccidentesModule`. Pruebas con Gemini y Supabase simulados: ids inexistentes descartados, repetidos quitados, máximo 10, la lista se carga una sola vez aunque Gemini llame varias herramientas, mensaje vacío → 502.
5. Frontend: agregar a `src/accidentes/types.ts` los tipos `ConsultaAsegurador`, `RespuestaConsulta` y `AccidenteMencionado`, y a `src/accidentes/api.ts` las funciones `consultarAccidentes` y `obtenerAccidente`.
6. Frontend: volver genérico `ChatFlotante`: recibe la etiqueta del botón y el chat como función `children(accionCerrar)`. El asegurado sigue usando `ChatAccidente` sin cambios visibles. Verificar con Playwright que el chat del asegurado se ve y funciona igual.
7. Frontend: crear `src/accidentes/ChatAsegurador.tsx` con el encabezado ("Asistente de accidentes", "Nueva conversación" y la cruz), el saludo, las tres sugerencias, la lista de mensajes con saltos de línea respetados, el estado "Gemini está escribiendo…" y el campo de texto. Un 502 o 503 muestra "No se pudo contactar al asistente, inténtalo de nuevo" y conserva la conversación; un 401 usa `useSesionExpirada`. Mostrarlo en `HomePage` con `ChatFlotante` solo para el asegurador, y dejar el margen inferior del botón también para ese rol.
8. Frontend: debajo de cada respuesta con accidentes, mostrar la lista de `AccidenteMencionado` con "Ver". "Ver" llama a `obtenerAccidente` y abre `DetalleAccidenteDialog` encima del panel; un 404 muestra "El accidente ya no existe" en el chat. Al guardar desde ese detalle, `HomePage` sube un contador `recarga` que `AccidentesTabla` recibe como prop para volver a pedir la lista.
9. Revisar `/home` con Playwright para ambos roles en escritorio y móvil, con la API real de Gemini (requisito de `CLAUDE.md`).

## Acceptance criteria

- [x] `POST /accidentes/consulta` y `GET /accidentes/:id` responden 401 sin token y 403 con el token de un asegurado.
- [x] `GET /accidentes/mios` con token de asegurado sigue respondiendo 200 con sus accidentes.
- [x] `GET /accidentes/:id` con token de asegurador responde 200 con el `AccidenteAsegurador`, y 404 con un id que no existe.
- [x] `POST /accidentes/consulta` responde 400 con body vacío, más de 40 mensajes, un mensaje de más de 2000 caracteres, un último mensaje del asistente o una zona horaria inválida.
- [x] Sin `GEMINI_API_KEY` en el `.env`, el backend arranca, la tabla de accidentes funciona y `POST /accidentes/consulta` responde 503.
- [x] Preguntar "¿cuántos accidentes hay pendientes?" responde el mismo número que muestra la tabla con el filtro "Pendiente".
- [x] Preguntar cuántos hay en cada estado responde los mismos números que la tabla con cada filtro.
- [x] Preguntar por los accidentes de un asegurado por su nombre o su `idContrato` responde sus accidentes y los lista con "Ver".
- [x] Preguntar por un accidente por sus placas responde a quién pertenece (nombre e `idContrato`) y su estado.
- [x] Ningún accidente de la lista "Ver" es inventado: todos existen en la tabla, y nunca hay más de 10.
- [x] Preguntar algo ajeno (p. ej. "¿quién ganó el mundial?") responde que solo ayuda con accidentes y sus asegurados, sin lista de accidentes.
- [x] Pedir "aprueba el accidente de las placas X" no cambia nada en la base de datos, y la respuesta indica que se hace desde "Ver".
- [x] La API key de Gemini no aparece en el código del frontend ni en ninguna petición del navegador.
- [x] Como asegurador, `/home` muestra un botón flotante en la esquina inferior derecha; al abrirlo aparece el saludo y las tres preguntas sugeridas, sin peticiones a `/accidentes/consulta`.
- [x] Hacer clic en una sugerencia la manda como mensaje y muestra la respuesta de Gemini.
- [x] "Ver" abre el detalle encima del chat con los datos del asegurado, el reporte, la foto y el formulario de estado.
- [x] Cambiar el estado desde ese detalle y guardar actualiza la fila en la tabla de accidentes sin recargar la página.
- [x] La cruz cierra el panel, y al reabrirlo la conversación sigue donde estaba.
- [x] "Nueva conversación" borra los mensajes y vuelve a mostrar el saludo y las sugerencias.
- [x] En móvil, el chat abierto ocupa toda la pantalla, la cruz lo cierra y el botón flotante no tapa la última fila de la tabla.
- [x] Como asegurado, el chat de la SPEC 03 se abre, conversa y registra accidentes igual que antes.
- [x] Las pruebas de Vitest de `obtener()`, las herramientas, `conversarConHerramientas()` y `ConsultaAseguradorService` pasan con `npm test`.
- [x] `/home` se revisó con Playwright para ambos roles en escritorio y móvil, sin errores en la consola.
- [x] `npm run lint` y `npm run build` pasan sin errores en `back-uatx-crud` y en `front-uatx-crud`.

## Decisions

- **Sí:** Function calling con herramientas de solo lectura definidas por el backend. Los conteos y filtros los calcula el código, no la IA, así que los números coinciden con la tabla.
- **No:** Mandar todos los accidentes en el contexto de cada turno. La IA contaría mal y el costo crece con cada accidente.
- **No:** Que Gemini genere SQL. Abre la puerta a inyección y a consultas costosas.
- **Sí:** El chat es de solo lectura. Cambiar el estado, anotar y eliminar siguen en el detalle y la tabla de la SPEC 04, donde hay confirmación explícita.
- **No:** Que el chat cambie estados, aunque pida confirmación. La IA podría elegir el accidente equivocado.
- **Sí:** Las herramientas cubren solo accidentes y el asegurado de cada uno. "A quién pertenece" sale de ese asegurado.
- **No:** Consultas sobre asegurados sin accidentes. Van en otra spec si se necesitan.
- **Sí:** Gemini recibe los mismos datos que el asegurador ve en el detalle (nombre, `idContrato`, correo, vencimiento, ubicación, vehículo, terceros y nota), pero nunca la foto.
- **Sí:** Las herramientas filtran en memoria sobre la lista de `listar()`, cargada una vez por turno. Reutiliza la consulta de la SPEC 04, todas las herramientas del turno ven los mismos datos y basta para el volumen del proyecto.
- **No:** Una consulta a Supabase por cada herramienta. Complica los filtros por nombre del asegurado en tablas unidas.
- **Sí:** El turno termina con la herramienta `responder` y `mode: 'ANY'`. Así la respuesta siempre trae `accidentesIds` estructurados sin depender de que el modelo combine herramientas con salida JSON.
- **Sí:** La lista de accidentes con "Ver" se arma con datos de la base, y los ids que no existen se descartan. Gemini no puede inventar un accidente en la lista.
- **Sí:** Máximo 5 rondas de herramientas y 10 accidentes por respuesta. Acota el costo y el tamaño del mensaje.
- **Sí:** El navegador manda su zona horaria y las instrucciones incluyen la fecha actual. Sin eso, "hoy" o "esta semana" no se pueden resolver.
- **Sí:** Botón flotante reutilizando `ChatFlotante`, que se vuelve genérico. No toca el layout de dos columnas de la SPEC 04.
- **No:** Un panel de chat fijo en la columna, que quita espacio a la tabla.
- **Sí:** "Ver" usa un nuevo `GET /accidentes/:id` y, al guardar, la tabla se recarga con un contador, igual que la tabla del asegurado. Funciona aunque el accidente no esté en la lista que cargó la tabla.
- **No:** Subir la lista de accidentes de `AccidentesTabla` a `HomePage` para compartirla con el chat.
- **Sí:** Texto plano con saltos de línea. **No:** Markdown, que agrega una dependencia y hay que sanitizar.
- **Sí:** Saludo fijo con tres preguntas sugeridas, sin llamar a Gemini al abrir.
- **Sí:** La conversación se conserva al cerrar el panel y se reinicia con "Nueva conversación" o al recargar.
- **Sí:** Las preguntas fuera de tema se rechazan amablemente. **No:** un asistente general, más difícil de controlar.
- **Sí:** `POST /accidentes/consulta` en el controlador del asegurador. `POST /accidentes/chat` ya es del asegurado y no se reutiliza la ruta.
- **Sí:** `conversarConHerramientas()` recibe además `herramientaFinal`, el nombre de la herramienta que cierra el turno. Así `GeminiService` no depende del nombre `responder`, que vive en `accidentes/` (ajuste hecho durante la implementación).
- **Sí:** El padding de `/home` se separa en `px` y `pt` responsivos con `pb: 12` fijo. Con `p` responsivo, sus media queries pisaban a `pb` y el botón flotante tapaba la última fila en móvil, también para el asegurado desde la SPEC 04 (corrección hecha durante la revisión con Playwright).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `GET /accidentes/:id` captura `GET /accidentes/mios` y el asegurado recibe 403 | `AccidentesController` se registra antes en `AccidentesModule`. Un criterio de aceptación lo verifica. |
| Gemini responde con un número sin llamar a las herramientas | `mode: 'ANY'` lo obliga a llamar herramientas, y las instrucciones exigen obtener cualquier dato con ellas. Los criterios comparan los números con la tabla. |
| Gemini entra en un ciclo de herramientas | Máximo 5 rondas; después responde 502 y el chat permite reintentar. |
| Gemini inventa ids o accidentes | Los ids se validan contra la base y la lista se arma con datos reales. El texto puede equivocarse, pero la lista "Ver" no. |
| El modelo de `GEMINI_MODEL` no soporta function calling con `mode: 'ANY'` | El modelo configurado (`gemini-3.8-flash`) lo soporta. Si se cambia, debe soportar function calling. |
| El detalle abierto desde el chat queda detrás del panel flotante | Ambos usan el `zIndex` de modal y el diálogo se monta después. Se revisa con Playwright en escritorio y móvil. |
| El accidente se eliminó entre la respuesta y el clic en "Ver" | `GET /accidentes/:id` da 404 y el chat muestra "El accidente ya no existe". |
| Gemini recibe datos personales de los asegurados | Aceptado: son los mismos que el asegurador ya ve, y la foto nunca se manda. Queda sujeto a los términos de la API de Gemini. |
| El historial completo y los resultados de herramientas encarecen cada turno | Límite de 40 mensajes, 2000 caracteres por mensaje, 20 resultados por búsqueda y 5 rondas. |
| La tabla no refleja un cambio de estado hecho en otra pestaña | Aceptado, igual que en la SPEC 04. El chat siempre consulta datos frescos en cada turno. |

## What is **not** in this spec

- Cambiar estado, nota o eliminar desde el chat.
- Consultas sobre asegurados sin accidentes.
- Foto del accidente en el chat o enviada a Gemini.
- Markdown, tablas o gráficas en las respuestas.
- Guardar o reanudar la conversación.
- Respuestas en streaming.
- SQL generado por Gemini.
- Chat por voz.

Cada uno de estos, si se implementa, va en su propia spec.
