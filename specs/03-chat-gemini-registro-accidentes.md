# SPEC 03 — Chat con IA Gemini para que el asegurado registre accidentes vehiculares

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-03
> **Objective:** Agregar en `/home` un chat guiado por Gemini donde el asegurado reporta un accidente vehicular con una foto validada por la IA, su ubicación y sus datos, y el accidente se guarda en Supabase con estado `pendiente`.

## Por qué existe esta spec

La SPEC 02 dejó vacío el recuadro "chat con ia gemini" de `references/ui/pantalla inicio.png` y pospuso todo lo relacionado con accidentes, porque la tabla de accidentes nace aquí. Esta spec da al asegurado la forma de reportar un siniestro sin llamar a la aseguradora. La foto validada por Gemini funciona como filtro: si la imagen no muestra un accidente, el reporte no procede y no se guarda nada. La consulta de los accidentes por parte del asegurador queda para la SPEC 04.

## Scope

**In:**

- Tabla `public.accidentes` con RLS habilitado y bucket privado `accidentes-fotos` en Supabase Storage.
- `AseguradoGuard` en el backend: deja pasar solo a usuarios que existen en `asegurados`.
- Integración con Gemini **solo en el backend** con el SDK oficial `@google/genai`. La API key vive en `back-uatx-crud/.env` (`GEMINI_API_KEY`) junto con el modelo (`GEMINI_MODEL`), y nunca llega al navegador.
- `POST /accidentes/foto`: Gemini analiza la foto y responde si es un accidente vehicular, con una descripción breve y la gravedad. **No guarda nada.** Si procede, el backend devuelve además una constancia firmada que amarra el análisis a esa foto exacta.
- `POST /accidentes/chat`: un turno de la entrevista guiada. El navegador manda el historial completo y el backend responde con el siguiente mensaje de Gemini, la etapa de la conversación y los datos reunidos hasta el momento.
- `POST /accidentes`: recibe los datos confirmados, la foto y su constancia. Verifica que la constancia sea válida y corresponda a esa foto, y solo entonces sube la foto a Storage y guarda el accidente con estado `pendiente`.
- Chat en `/home` solo para el rol `asegurado`, en el lugar que marca la maqueta.
- Entrevista guiada con estos datos obligatorios: "¿estás bien?", una foto validada, ubicación, fecha y hora del accidente, datos del vehículo (marca, modelo y placas) y terceros involucrados.
- Si el asegurado responde que no está bien, el chat recomienda llamar al 911, muestra el botón que abre el diálogo de confirmación de la SPEC 02 y la entrevista continúa.
- Ubicación con el GPS del navegador (latitud y longitud) y, si el permiso se niega o falla, la dirección escrita en el chat.
- Confirmación al final: el chat muestra los datos del vehículo y de los terceros con los botones "Confirmar" y "Corregir". Al confirmar se guarda el accidente y el chat termina y se limpia; el botón "Nuevo reporte" empieza otra conversación.
- Cambio en el CRUD de la SPEC 02: `DELETE /asegurados/:id` responde 409 si el asegurado tiene accidentes registrados.

**Out of scope (for future specs):**

- Chat o vista de accidentes para el asegurador, consulta de accidentes pendientes y a quién pertenecen (SPEC 04, CRUD de accidentes).
- Estados del accidente distintos de `pendiente` y sus transiciones (SPEC 04).
- Ver la foto guardada desde la UI (SPEC 04; el asegurado solo ve la vista previa local mientras chatea).
- Más de una foto por accidente.
- Guardar los mensajes del chat en una tabla.
- Reanudar una conversación después de recargar la página.
- Accidentes que no sean vehiculares (hogar, gastos médicos, etc.).
- Respuestas en streaming (el mensaje de Gemini llega completo).
- Mapa interactivo o geocodificación inversa (convertir coordenadas en dirección).

## Data model

Migración `supabase/migrations/crear_accidentes.sql`, aplicada con `mcp__supabase__apply_migration`:

```sql
create table public.accidentes (
  id uuid primary key default gen_random_uuid(),
  asegurado_id uuid not null references public.asegurados(id) on delete restrict,
  estado text not null default 'pendiente' check (estado in ('pendiente')),
  fecha_hora_accidente timestamptz not null,
  fecha_reporte timestamptz not null default now(),
  resumen text not null,
  asegurado_bien boolean not null,
  latitud double precision,
  longitud double precision,
  direccion text,
  vehiculo_marca text not null,
  vehiculo_modelo text not null,
  vehiculo_placas text not null,
  hay_terceros boolean not null,
  terceros_descripcion text,
  foto_path text not null unique,
  foto_descripcion text not null,
  gravedad text not null check (gravedad in ('leve', 'moderado', 'grave')),
  -- Se necesita GPS o dirección escrita
  check ((latitud is not null and longitud is not null) or direccion is not null),
  check (not hay_terceros or terceros_descripcion is not null)
);

alter table public.accidentes enable row level security;
-- Sin políticas: solo el backend accede, con el cliente service-role
```

Bucket de Storage (en la misma migración):

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accidentes-fotos', 'accidentes-fotos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);
```

- Ruta de cada foto: `{aseguradoId}/{uuid}.{jpg|png|webp}`.
- El bucket es privado y sin políticas: solo el backend sube y lee.
- Una foto solo llega al bucket al confirmar un accidente válido. No existen fotos sin accidente.

Constancia de la foto (no se guarda en ninguna tabla; viaja en el navegador):

```ts
// Contenido firmado con HMAC-SHA256 usando CONSTANCIA_SECRET (back-uatx-crud/.env)
interface ContenidoConstancia {
  aseguradoId: string;
  fotoSha256: string;       // huella de los bytes exactos de la foto
  descripcion: string;      // análisis de Gemini
  gravedad: 'leve' | 'moderado' | 'grave';
  expira: number;           // epoch en ms; 1 hora después del análisis
}
// Formato: base64url(JSON del contenido) + "." + base64url(firma)
```

Contratos de la API (backend `src/accidentes/`, frontend `src/accidentes/types.ts`):

```ts
// Respuesta de POST /accidentes/foto (multipart, campo "foto"); no guarda nada
type AnalisisFoto =
  | { procede: true; descripcion: string; gravedad: 'leve' | 'moderado' | 'grave'; constancia: string }
  | { procede: false; mensaje: string }; // p. ej. "No procede: la foto no muestra un accidente vehicular"

// Body de POST /accidentes/chat
interface ChatDto {
  mensajes: { rol: 'usuario' | 'asistente'; texto: string }[]; // máx. 40 mensajes, 2000 caracteres cada uno
}

// Respuesta de POST /accidentes/chat
interface RespuestaChat {
  mensaje: string;                            // texto que el chat muestra
  etapa: 'entrevista' | 'confirmacion';       // 'confirmacion' solo cuando ya están todos los datos
  sugerir911: boolean;                        // true si el asegurado dijo que no está bien
  datos: Partial<DatosAccidente>;             // lo reunido hasta ahora
}

// Datos que reúne la entrevista (camelCase en la API, snake_case en la tabla)
interface DatosAccidente {
  aseguradoBien: boolean;
  fechaHoraAccidente: string;   // ISO 8601
  resumen: string;              // lo que pasó, en palabras de Gemini
  direccion?: string;           // si no hubo GPS
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoPlacas: string;
  hayTerceros: boolean;
  tercerosDescripcion?: string;
}

// POST /accidentes es multipart con tres campos:
//   foto        -> el mismo archivo que se analizó
//   constancia  -> la que devolvió POST /accidentes/foto
//   datos       -> JSON con CrearAccidenteDto
interface CrearAccidenteDto extends DatosAccidente {
  latitud?: number;
  longitud?: number;
}
// foto_descripcion y gravedad se toman de la constancia verificada, no del navegador
```

Códigos de respuesta:

| Caso | Código |
| --- | --- |
| Sin token o token inválido/expirado | 401 |
| Token válido de un asegurador (no está en `asegurados`) | 403 |
| Body inválido, foto de más de 5 MB o de otro tipo | 400 |
| Constancia alterada, vencida, de otro asegurado o que no corresponde a la foto enviada | 400 |
| Falta `GEMINI_API_KEY`, `GEMINI_MODEL` o `CONSTANCIA_SECRET` en el `.env` | 503 |
| Gemini falla o no responde | 502 |
| `POST /accidentes` exitoso | 201 |
| `DELETE /asegurados/:id` de un asegurado con accidentes | 409 |

Conventions:

- La conversación vive solo en el estado del componente del chat. El backend no guarda mensajes: recibe el historial completo en cada turno y se lo pasa a Gemini.
- La foto validada y su constancia también viven solo en el estado del chat hasta la confirmación. Limpiar el chat las descarta.
- El resultado del análisis de la foto y la ubicación entran al historial como mensajes del chat (p. ej. "Ubicación compartida: 19.31, -98.24"), para que Gemini sepa que ya se tienen.
- Las instrucciones de la entrevista (orden de las preguntas, tono y "no inventar datos") viven en `src/accidentes/prompt.ts` del backend.
- Gemini responde con salida estructurada (JSON con el esquema de `RespuestaChat`). El backend valida esa respuesta y solo acepta `etapa: 'confirmacion'` si `datos` trae todos los campos obligatorios.
- Orden de la entrevista: "¿estás bien?", foto, ubicación, fecha y hora, vehículo, terceros, confirmación.
- Un reporte que no procede termina la conversación: el chat muestra el mensaje de Gemini y el botón "Nuevo reporte", que la limpia.

## Implementation plan

1. Base de datos: crear `supabase/migrations/crear_accidentes.sql` con la tabla `accidentes`, RLS y el bucket `accidentes-fotos`, y aplicarla con `mcp__supabase__apply_migration`. Verificar con `list_tables` y una consulta a `storage.buckets`.
2. Backend: crear `src/auth/asegurado.guard.ts` (`AseguradoGuard`), simétrico a `AseguradorGuard`: valida el token y exige que el id exista en `asegurados`; deja el id disponible para el controlador. Exportarlo desde `AuthModule`. Pruebas unitarias: sin token, token inválido, asegurador → 403, asegurado.
3. Backend: en `AseguradosService.eliminar()`, responder 409 "El asegurado tiene accidentes registrados" si existe alguna fila en `accidentes` con su id, antes de llamar a `deleteUser`. Agregar la prueba unitaria.
4. Backend: instalar `@google/genai` y crear `src/gemini/` (`GeminiModule`, `GeminiService`). Lee `GEMINI_API_KEY` y `GEMINI_MODEL` al usarse, no al arrancar: si faltan, responde 503 y el resto del backend sigue funcionando. Agregar ambas variables y `CONSTANCIA_SECRET` a `.env.example`.
5. Backend: crear `src/accidentes/constancia.ts` con `firmarConstancia()` y `verificarConstancia()` (HMAC-SHA256 con `node:crypto` y comparación en tiempo constante). Pruebas unitarias: constancia válida, contenido alterado, firma alterada, vencida, otro asegurado y huella distinta.
6. Backend: crear `AccidentesModule` y `POST /accidentes/foto` (protegido con `AseguradoGuard`, `FileInterceptor` de multer con límite de 5 MB y tipos JPEG/PNG/WebP). `GeminiService.analizarFoto()` devuelve `{ esAccidente, descripcion, gravedad }` con salida estructurada. Si procede, responde el análisis y la constancia firmada; si no, responde `procede: false`. En ningún caso sube la foto.
7. Backend: crear `src/accidentes/prompt.ts` y `POST /accidentes/chat` con `ChatDto`. `GeminiService.conversar()` manda las instrucciones y el historial, y pide la respuesta con el esquema de `RespuestaChat`. Si Gemini propone `confirmacion` con datos incompletos, el backend la cambia a `entrevista`.
8. Backend: agregar `CrearAccidenteDto` y `POST /accidentes` (multipart: `foto`, `constancia` y `datos`). Verifica la constancia contra el id del token y la huella SHA-256 de la foto recibida. Si es válida, sube la foto a `accidentes-fotos/{aseguradoId}/{uuid}.{ext}` e inserta la fila con `estado = 'pendiente'` y la descripción y gravedad de la constancia. Si el insert falla, borra la foto recién subida. Responde 201. Pruebas unitarias de `AccidentesService` con Supabase y Gemini simulados: crear válido, constancia inválida → 400 sin subir nada, insert fallido borra la foto, análisis que no procede no devuelve constancia, `confirmacion` incompleta se degrada a `entrevista`.
9. Frontend: mover `SesionExpiradaError` y el helper de peticiones con `Bearer` de `src/asegurados/api.ts` a `src/api/peticion.ts` para compartirlos. Crear `src/accidentes/types.ts` y `src/accidentes/api.ts` (`analizarFoto`, `conversar`, `crearAccidente`).
10. Frontend: crear `src/accidentes/ChatAccidente.tsx` con la lista de mensajes, el campo de texto y el estado "Gemini está escribiendo…". Al abrirse, el chat pregunta "¿Estás bien?". Mostrarlo en `HomePage` solo para el asegurado: en escritorio, tres columnas (datos personales, botón 911 y chat), como en la maqueta; en móvil, una sola columna.
11. Frontend: botón para adjuntar la foto en el chat (`accept="image/*"`, `capture="environment"` en móvil) con vista previa. Si procede, muestra la descripción y la gravedad, y guarda el archivo y la constancia en el estado del chat hasta la confirmación. Si no procede, muestra el mensaje "No procede" y el botón "Nuevo reporte".
12. Frontend: botón "Compartir ubicación" con `navigator.geolocation`. Si el permiso se niega o falla, el chat pide escribir la dirección.
13. Frontend: cuando la respuesta trae `sugerir911: true`, mostrar dentro del chat el aviso y el `BotonLlamar911` de la SPEC 02 sin interrumpir la entrevista.
14. Frontend: cuando la etapa es `confirmacion`, mostrar la tarjeta con los datos del vehículo y de los terceros y los botones "Confirmar" y "Corregir". "Corregir" devuelve el foco al campo de texto para escribir la corrección. "Confirmar" llama a `POST /accidentes` con la foto, la constancia y los datos, muestra "Tu accidente quedó registrado", limpia el chat y muestra el botón "Nuevo reporte" en lugar de volver a preguntar. Un 401 en cualquier llamada usa `useSesionExpirada`.
15. Revisar `/home` con Playwright para ambos roles contra la maqueta (requisito de `CLAUDE.md`), con la API real de Gemini y el `.env` configurado.

## Acceptance criteria

- [ ] La tabla `accidentes` existe con RLS habilitado y el bucket `accidentes-fotos` existe como privado, con límite de 5 MB y tipos JPEG/PNG/WebP.
- [ ] `POST /accidentes/chat`, `POST /accidentes/foto` y `POST /accidentes` responden 401 sin token y 403 con el token de un asegurador.
- [ ] Sin `GEMINI_API_KEY` en el `.env`, el backend arranca, el login y el CRUD de asegurados funcionan, y `POST /accidentes/chat` responde 503.
- [ ] La API key de Gemini y `CONSTANCIA_SECRET` no aparecen en el código del frontend ni en ninguna petición del navegador.
- [ ] `POST /accidentes/foto` con la foto de un choque responde `procede: true`, una descripción, una gravedad y una constancia, y el bucket sigue vacío.
- [ ] `POST /accidentes/foto` con una foto que no es un accidente (p. ej. un paisaje) responde `procede: false` con un mensaje "No procede", sin constancia, y el bucket sigue vacío.
- [ ] `POST /accidentes/foto` con un archivo de más de 5 MB o un PDF responde 400.
- [ ] `POST /accidentes` responde 400 y no sube nada si la constancia está alterada, vencida, es de otro asegurado o se manda con una foto distinta a la analizada.
- [ ] `POST /accidentes` válido responde 201, la foto aparece en el bucket y la fila queda con `estado = 'pendiente'`, el `asegurado_id` del token y la descripción y gravedad de la constancia.
- [ ] Después de las pruebas, el bucket solo contiene fotos que corresponden a una fila de `accidentes`.
- [ ] `DELETE /asegurados/:id` de un asegurado con accidentes responde 409 y el asegurado sigue existiendo.
- [ ] Como asegurado, `/home` muestra el chat junto a "Datos personales" y "Llamar al 911", con la disposición de `references/ui/pantalla inicio.png`.
- [ ] Como asegurador, `/home` no muestra el chat.
- [ ] Al abrir `/home`, el chat pregunta "¿Estás bien?".
- [ ] Responder que no está bien muestra la recomendación y el botón del 911 dentro del chat, y la entrevista continúa.
- [ ] El chat no llega a la confirmación sin foto validada, ubicación, fecha y hora, datos del vehículo y terceros.
- [ ] Negar el permiso de ubicación hace que el chat pida la dirección escrita, y con ella se puede completar el reporte.
- [ ] Una foto que no procede muestra el mensaje de Gemini y "Nuevo reporte", y no se guarda ningún accidente.
- [ ] En la confirmación aparecen los datos del vehículo y de los terceros con "Confirmar" y "Corregir".
- [ ] "Corregir" permite cambiar esos datos en la conversación y vuelve a mostrar la confirmación con los datos nuevos.
- [ ] "Confirmar" guarda el accidente, muestra "Tu accidente quedó registrado" y deja el chat limpio con el botón "Nuevo reporte", que empieza de nuevo con "¿Estás bien?".
- [ ] Recargar la página a mitad de la conversación la reinicia y no guarda nada.
- [ ] Las pruebas de Vitest de `AseguradoGuard`, la constancia, `AccidentesService` y el nuevo caso de `AseguradosService` pasan con `npm test`.
- [ ] `/home` se revisó con Playwright para ambos roles, sin errores en la consola.
- [ ] `npm run lint` y `npm run build` pasan sin errores en `back-uatx-crud` y en `front-uatx-crud`.

## Decisions

- **Sí:** Gemini se llama solo desde el backend con `@google/genai`, y la key va en `back-uatx-crud/.env`. Lo recomienda la documentación de Gemini y evita exponer la key en el navegador.
- **No:** Llamar a Gemini desde el frontend.
- **Sí:** `GEMINI_MODEL` en el `.env`, sin un modelo fijo en el código. El modelo elegido debe aceptar imágenes y salida estructurada.
- **Sí:** Las variables de Gemini se leen al usarse y su ausencia da 503. El backend arranca aunque todavía no exista la key.
- **Sí:** El chat es solo para el asegurado. El asegurador verá y consultará los accidentes en la SPEC 04.
- **Sí:** Entrevista guiada que solo sirve para reportar accidentes. **No:** asistente libre sobre la póliza, que es más difícil de controlar.
- **Sí:** Solo accidentes vehiculares. Define las preguntas de la entrevista (vehículo, placas, terceros).
- **Sí:** Una sola foto obligatoria, analizada por Gemini, que responde si es un accidente, una descripción breve y la gravedad. **No:** varias fotos.
- **Sí:** Si la foto no es un accidente, el reporte no procede, no se guarda nada y la conversación termina con "Nuevo reporte". **No:** guardar los reportes rechazados.
- **Sí:** La foto solo se guarda en Storage al confirmar un accidente. `POST /accidentes/foto` solo analiza y devuelve una constancia firmada (HMAC-SHA256 con `CONSTANCIA_SECRET`) que amarra el análisis a la huella de esa foto, al asegurado y a un vencimiento de 1 hora. Al confirmar, el backend verifica la constancia contra la foto recibida. Así no hay fotos sin accidente, hay una sola llamada a Gemini por foto, el backend no guarda estado y el navegador no puede alterar la descripción ni la gravedad.
- **No:** subir la foto al validarla, que deja fotos huérfanas si el asegurado abandona el chat.
- **No:** volver a analizar la foto al confirmar, que duplica las llamadas a Gemini y podría dar un resultado distinto.
- **No:** retener la foto en memoria del backend, que se pierde al reiniciarlo.
- **Sí:** `CONSTANCIA_SECRET` es una variable propia y no se reutiliza la service role key de Supabase. Así una se puede rotar sin afectar a la otra.
- **Sí:** Foto, ubicación y "¿estás bien?" son obligatorios, junto con la fecha y hora, el vehículo y los terceros.
- **Sí:** GPS del navegador con respaldo de dirección escrita. Se guardan coordenadas o dirección, al menos una de las dos.
- **Sí:** Si el asegurado no está bien, se ofrece el 911 y la entrevista sigue. **No:** pausar el reporte.
- **Sí:** Los mensajes viven en el navegador y se mandan completos en cada turno. El backend no guarda estado. **No:** guardar la conversación en memoria del backend ni en una tabla.
- **Sí:** Solo se confirman los datos del vehículo y de los terceros con "Confirmar" y "Corregir". Los demás datos no se confirman. Al confirmar, el chat termina y se limpia, y el asegurado empieza otro reporte con "Nuevo reporte" cuando lo decida. **No:** volver a preguntar "¿Estás bien?" de inmediato (ajuste pedido durante la implementación).
- **Sí:** El accidente nace con `estado = 'pendiente'`. La SPEC 04 agrega los demás estados.
- **Sí:** No se puede eliminar a un asegurado con accidentes (409 en el backend y `on delete restrict` en la tabla). Corrige la decisión de borrado en cascada de la SPEC 02 ahora que existen accidentes ligados. **No:** borrar en cascada sus accidentes y fotos.
- **Sí:** Salida estructurada de Gemini validada por el backend, que solo acepta la confirmación con todos los datos. Evita que la IA cierre un reporte incompleto.
- **Sí:** Una sola spec, aunque toque tabla, Storage, Gemini, ubicación y UI. La foto validada es el filtro del registro y separarla dejaría una spec que registra accidentes sin validar.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Gemini clasifica mal una foto (falso positivo o falso negativo) | Aceptado para esta spec. El asegurador revisará los reportes en la SPEC 04 y la foto queda guardada como evidencia. |
| El asegurado manda al confirmar una foto distinta a la analizada, o altera la descripción o la gravedad | La constancia firmada amarra el análisis a la huella SHA-256 de la foto y al asegurado. Cualquier cambio da 400 y no se guarda nada. |
| La constancia vence (1 hora) antes de que el asegurado confirme | `POST /accidentes` responde 400 y el chat pide volver a mandar la foto para analizarla de nuevo. |
| `CONSTANCIA_SECRET` se filtra y alguien fabrica constancias | Solo vive en `.env`. Basta con cambiarla para invalidar todas las constancias emitidas. |
| La subida a Storage funciona pero el insert del accidente falla | `POST /accidentes` borra la foto recién subida, igual que `crear()` borra la cuenta en la SPEC 02. |
| Gemini no responde, tarda o excede su cuota | El backend responde 502. El chat muestra "No se pudo contactar al asistente, inténtalo de nuevo" y conserva la conversación para reintentar. |
| Gemini inventa datos o marca la confirmación sin tenerlos todos | Las instrucciones prohíben inventar datos, y el backend degrada a `entrevista` cualquier confirmación incompleta. |
| El historial completo en cada turno crece y encarece las llamadas | Límite de 40 mensajes y 2000 caracteres por mensaje en `ChatDto`. |
| El navegador no permite la geolocalización (escritorio sin GPS, HTTP fuera de `localhost`, permiso negado) | Respaldo con la dirección escrita en el chat. |
| La key de Gemini se sube por error a git | Solo vive en `.env`, que ya está en `.gitignore`. `.env.example` lleva las variables vacías. |
| El costo o la cuota gratuita de Gemini | Aceptado para el volumen del proyecto. Una foto y unos 10 turnos por reporte. |

## What is **not** in this spec

- Chat o vista de accidentes para el asegurador (SPEC 04).
- Estados del accidente distintos de `pendiente` (SPEC 04).
- Ver la foto guardada desde la UI (SPEC 04).
- Más de una foto por accidente.
- Guardar los mensajes del chat.
- Reanudar una conversación después de recargar.
- Accidentes no vehiculares.
- Respuestas en streaming.
- Mapa interactivo o geocodificación inversa.

Cada uno de estos, si se implementa, va en su propia spec.
