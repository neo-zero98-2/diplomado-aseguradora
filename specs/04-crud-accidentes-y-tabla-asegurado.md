# SPEC 04 — CRUD de accidentes para el asegurador y tabla de accidentes del asegurado en `/home`

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02, SPEC 03
> **Date:** 2026-10-03
> **Objective:** Rediseñar `/home` en dos columnas para que el asegurador consulte, cambie de estado, anote y elimine los accidentes reportados, y el asegurado vea en una tabla de solo lectura el estado de sus accidentes, con el chat de la SPEC 03 movido a un botón flotante.

## Por qué existe esta spec

La SPEC 03 guarda accidentes con estado `pendiente`, pero nadie puede verlos sin entrar a Supabase. El asegurador necesita su herramienta de trabajo para revisarlos y saber a quién pertenecen. El asegurado necesita saber qué pasó con lo que reportó. El chat de Gemini para el asegurador se pidió junto con esto, pero se separa en la SPEC 05: depende de que existan los estados y la consulta que define esta spec.

## Scope

**In:**

- Migración que amplía los estados del accidente a `pendiente`, `en_revision`, `aprobado` y `rechazado`, y agrega `nota_asegurador`, `actualizado_por` y `fecha_actualizacion`.
- Endpoints del asegurador (protegidos por `AseguradorGuard`): `GET /accidentes`, `GET /accidentes/:id/foto`, `PATCH /accidentes/:id` y `DELETE /accidentes/:id`.
- Endpoint del asegurado (protegido por `AseguradoGuard`): `GET /accidentes/mios`.
- `AseguradorGuard` deja disponible el id del asegurador para el controlador (hoy solo valida).
- `/home` en dos columnas para ambos roles: a la izquierda "Datos personales"; a la derecha los botones existentes arriba ("Llamar al 911" y, para el asegurador, "Administrar asegurados") y debajo la tabla de accidentes.
- Tabla de accidentes del asegurador: filtro por estado (arranca en "Pendiente", con la opción "Todos"), búsqueda en el cliente por nombre del asegurado, `idContrato` o placas, y acciones "Ver" y "Eliminar".
- Diálogo de detalle del asegurador: datos del asegurado (nombre, `idContrato`, correo, fecha de vencimiento), datos completos del reporte, la foto con una URL firmada temporal, la última actualización (asegurador y fecha) y el formulario para cambiar el estado y la nota.
- Eliminar un accidente: diálogo de confirmación, borrado físico de la fila y de su foto en Storage.
- Tabla informativa del asegurado (solo lectura): fecha del accidente, vehículo (marca, modelo y placas), gravedad, estado y nota del asegurador. Se recarga sola cuando el chat registra un accidente.
- Cambio a la SPEC 03: el chat del asegurado deja la tercera columna y pasa a un botón flotante en la esquina inferior derecha. Al hacer clic se abre el panel del chat, que tiene una cruz para cerrarlo.

**Out of scope (for future specs):**

- Chat de Gemini para el asegurador que consulta los accidentes pendientes y a quién pertenecen (SPEC 05).
- Que el asegurador cree accidentes (los accidentes solo nacen desde el chat del asegurado).
- Editar los datos del reporte (vehículo, terceros, ubicación, fecha, resumen, gravedad, foto).
- Historial de cambios de estado (solo se guarda la última actualización).
- Reglas de transición entre estados (cualquier estado puede pasar a cualquier otro).
- Que el asegurado vea la foto o el detalle completo de su accidente.
- Notificaciones al asegurado cuando cambia el estado.
- Borrado lógico de accidentes.
- Paginación y búsqueda en el servidor.
- Actualización en tiempo real de las tablas (Supabase Realtime).

## Data model

Migración `supabase/migrations/gestion_accidentes.sql`, aplicada con `mcp__supabase__apply_migration`:

```sql
alter table public.accidentes drop constraint accidentes_estado_check;
alter table public.accidentes add constraint accidentes_estado_check
  check (estado in ('pendiente', 'en_revision', 'aprobado', 'rechazado'));

alter table public.accidentes
  add column nota_asegurador text check (char_length(nota_asegurador) <= 1000),
  add column actualizado_por uuid references public.aseguradores(id) on delete set null,
  add column fecha_actualizacion timestamptz;
```

- El nombre `accidentes_estado_check` es el que Postgres asigna por defecto. El paso 1 lo verifica antes de aplicar la migración.
- Los accidentes existentes quedan en `pendiente`, sin nota y sin actualización.
- RLS sigue habilitado y sin políticas: solo el backend accede, con el cliente service-role.

Contratos de la API (backend `src/accidentes/`, frontend `src/accidentes/types.ts`):

```ts
type EstadoAccidente = 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado';

// Elemento de GET /accidentes (asegurador) y respuesta de PATCH /accidentes/:id
interface AccidenteAsegurador {
  id: string;
  estado: EstadoAccidente;
  fechaHoraAccidente: string;   // ISO 8601
  fechaReporte: string;         // ISO 8601
  resumen: string;
  aseguradoBien: boolean;
  latitud: number | null;
  longitud: number | null;
  direccion: string | null;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoPlacas: string;
  hayTerceros: boolean;
  tercerosDescripcion: string | null;
  fotoDescripcion: string;
  gravedad: 'leve' | 'moderado' | 'grave';
  notaAsegurador: string | null;
  fechaActualizacion: string | null;
  actualizadoPor: { id: string; nombre: string } | null;
  asegurado: {
    id: string;
    nombre: string;
    idContrato: string;
    correo: string;
    fechaVencimiento: string;   // 'YYYY-MM-DD'
  };
}

// Respuesta de GET /accidentes/:id/foto
interface FotoAccidente {
  url: string;                  // URL firmada de Storage, válida 10 minutos
}

// Body de PATCH /accidentes/:id (al menos uno de los dos)
interface ActualizarAccidenteDto {
  estado?: EstadoAccidente;
  notaAsegurador?: string | null; // máx. 1000 caracteres; '' o null borran la nota
}

// Elemento de GET /accidentes/mios (asegurado)
interface MiAccidente {
  id: string;
  fechaHoraAccidente: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoPlacas: string;
  gravedad: 'leve' | 'moderado' | 'grave';
  estado: EstadoAccidente;
  notaAsegurador: string | null;
}
```

Códigos de respuesta:

| Caso | Código |
| --- | --- |
| Sin token o token inválido/expirado | 401 |
| `GET /accidentes`, `GET /accidentes/:id/foto`, `PATCH` o `DELETE` con token de un asegurado | 403 |
| `GET /accidentes/mios` con token de un asegurador | 403 |
| `:id` sin formato UUID (`ParseUUIDPipe`) | 400 |
| Body de `PATCH` vacío, estado inválido o nota de más de 1000 caracteres | 400 |
| `:id` no existe en `accidentes` | 404 |
| `DELETE` exitoso | 204 |

Conventions:

- `GET /accidentes` devuelve todos los accidentes, ordenados por `fecha_reporte` descendente. El filtro por estado y la búsqueda se hacen en el cliente.
- `GET /accidentes/mios` devuelve solo los accidentes del `asegurado_id` del token, ordenados por `fecha_reporte` descendente.
- Cada `PATCH` exitoso escribe `actualizado_por` con el id del asegurador del token y `fecha_actualizacion = now()`.
- La nota se guarda sin espacios al inicio ni al final. Una nota vacía se guarda como `null`.
- Etiquetas en la UI: `pendiente` → "Pendiente", `en_revision` → "En revisión", `aprobado` → "Aprobado", `rechazado` → "Rechazado". Cada estado se muestra con un `Chip` de MUI de color distinto.
- Las fechas con hora se muestran como `DD/MM/YYYY HH:mm` en la hora local del navegador. `fechaVencimiento` se muestra como `DD/MM/YYYY` con el helper existente de `src/utils/fechas.ts`.
- El chat flotante solo se oculta al cerrarse: el componente sigue montado y la conversación, la foto y la constancia se conservan hasta recargar la página.

## Implementation plan

1. Base de datos: confirmar con `execute_sql` el nombre del check de `estado`. Crear `supabase/migrations/gestion_accidentes.sql` y aplicarlo con `mcp__supabase__apply_migration`. Verificar con `list_tables` que existen las tres columnas nuevas.
2. Backend: hacer que `AseguradorGuard` guarde el id validado en la petición (`PeticionAsegurador { aseguradorId }`), igual que `AseguradoGuard`. Actualizar sus pruebas unitarias.
3. Backend: agregar `AccidentesService.listarMios(aseguradoId)` y `GET /accidentes/mios` en `AccidentesController` (ya protegido por `AseguradoGuard`), con el mapeo a `MiAccidente`. Prueba unitaria: solo pide los accidentes de ese asegurado.
4. Backend: crear `src/accidentes/accidentes-asegurador.controller.ts` (`@Controller('accidentes')` con `AseguradorGuard`) y `accidentes-asegurador.service.ts` con `listar()` para `GET /accidentes`. La consulta trae el asegurado y el asegurador de la última actualización con los joins de Supabase y mapea a `AccidenteAsegurador`. Registrar ambos en `AccidentesModule`.
5. Backend: agregar `ActualizarAccidenteDto` (class-validator) y `actualizar()` para `PATCH /accidentes/:id`. Escribe `actualizado_por` y `fecha_actualizacion`, responde el `AccidenteAsegurador` actualizado y da 404 si no existe.
6. Backend: agregar `obtenerFoto()` para `GET /accidentes/:id/foto` con `storage.createSignedUrl(foto_path, 600)` sobre `accidentes-fotos`. 404 si el accidente no existe.
7. Backend: agregar `eliminar()` para `DELETE /accidentes/:id`. Borra la fila y después la foto de Storage. Si falla el borrado de la foto, lo registra en el log y responde 204 igual. Pruebas unitarias del servicio con Supabase simulado: listar con el mapeo del asegurado, actualizar escribe el asegurador y la fecha, actualizar inexistente → 404, eliminar borra la foto, eliminar inexistente → 404 sin tocar Storage.
8. Frontend: agregar a `src/accidentes/types.ts` los tipos nuevos y a `src/accidentes/api.ts` las funciones `listarAccidentes`, `obtenerFotoAccidente`, `actualizarAccidente`, `eliminarAccidente` y `listarMisAccidentes`. Crear `src/accidentes/estados.ts` con las etiquetas y colores de cada estado y gravedad.
9. Frontend: crear `src/accidentes/ChatFlotante.tsx`: un `Fab` en la esquina inferior derecha que abre un panel de unos 380×560 px con un encabezado y una cruz para cerrarlo. En móvil (`xs`) el panel ocupa toda la pantalla. El panel envuelve a `ChatAccidente` y lo oculta sin desmontarlo. Agregar a `ChatAccidente` la prop opcional `onAccidenteRegistrado`, que se llama al confirmar con éxito.
10. Frontend: reorganizar `HomePage` en dos columnas para ambos roles (`320px 1fr` en escritorio, una columna en móvil): "Datos personales" a la izquierda; a la derecha los botones arriba y un espacio para la tabla debajo. Para el asegurado, reemplazar la tercera columna del chat por `ChatFlotante`.
11. Frontend: crear `src/accidentes/MisAccidentesTabla.tsx` (solo lectura) con las columnas fecha, vehículo, gravedad, estado y nota, y los estados de carga, vacío ("Aún no has reportado accidentes") y error. Mostrarla en `HomePage` para el asegurado y recargarla desde `onAccidenteRegistrado`. Un 401 usa `useSesionExpirada`.
12. Frontend: crear `src/accidentes/AccidentesTabla.tsx` para el asegurador con las columnas asegurado, `idContrato`, fecha del accidente, placas, gravedad, estado y acciones. Agregar el selector de estado (arranca en "Pendiente") y la búsqueda en el cliente, con los estados de carga, vacío y error. Mostrarla en `HomePage` para el asegurador.
13. Frontend: crear `src/accidentes/DetalleAccidenteDialog.tsx`, que se abre con "Ver". Muestra los datos del asegurado, el reporte completo, la foto (pide la URL firmada al abrir) y la última actualización. Incluye el selector de estado, el campo de nota y el botón "Guardar". Al guardar, actualiza la fila en la tabla sin recargar la página y muestra los errores 400/404 dentro del diálogo.
14. Frontend: crear `src/accidentes/EliminarAccidenteDialog.tsx` con la confirmación. Al confirmar, quita la fila de la tabla. Revisar `/home` con Playwright para ambos roles en escritorio y móvil (requisito de `CLAUDE.md`).

## Acceptance criteria

- [x] La tabla `accidentes` acepta los estados `pendiente`, `en_revision`, `aprobado` y `rechazado`, rechaza cualquier otro y tiene las columnas `nota_asegurador`, `actualizado_por` y `fecha_actualizacion`.
- [x] `GET /accidentes`, `GET /accidentes/:id/foto`, `PATCH /accidentes/:id` y `DELETE /accidentes/:id` responden 401 sin token y 403 con el token de un asegurado.
- [x] `GET /accidentes/mios` responde 401 sin token y 403 con el token de un asegurador.
- [x] `GET /accidentes` con token de asegurador responde 200 con todos los accidentes ordenados por `fechaReporte` descendente, cada uno con el nombre, `idContrato`, correo y vencimiento de su asegurado.
- [x] `GET /accidentes/mios` responde solo los accidentes del asegurado del token.
- [x] `PATCH /accidentes/:id` con un estado válido responde 200, y la fila queda con ese estado, `actualizado_por` igual al asegurador del token y `fecha_actualizacion` con la hora del cambio.
- [x] `PATCH /accidentes/:id` con body vacío, un estado inválido o una nota de más de 1000 caracteres responde 400.
- [x] `PATCH`, `DELETE` y `GET /accidentes/:id/foto` con un id inexistente responden 404.
- [x] `GET /accidentes/:id/foto` devuelve una URL que muestra la foto en el navegador.
- [x] `DELETE /accidentes/:id` responde 204, y la fila y su foto ya no existen en `accidentes` ni en el bucket.
- [x] Después de eliminar el último accidente de un asegurado, `DELETE /asegurados/:id` de ese asegurado responde 204.
- [x] En `/home`, ambos roles ven dos columnas en escritorio: "Datos personales" a la izquierda; a la derecha los botones arriba y la tabla de accidentes debajo. En móvil se ve una sola columna sin scroll horizontal de la página.
- [x] Como asegurador, "Administrar asegurados" sigue llevando a `/asegurados`.
- [x] Como asegurador, la tabla arranca mostrando solo los accidentes en "Pendiente". Cambiar el filtro a "Todos" u otro estado no hace peticiones nuevas.
- [x] Como asegurador, escribir en la búsqueda filtra por nombre del asegurado, `idContrato` o placas sin hacer peticiones nuevas.
- [x] Como asegurador, "Ver" abre el detalle con los datos del asegurado, el reporte completo, la foto y la última actualización.
- [x] Como asegurador, cambiar el estado o la nota y guardar actualiza la fila de la tabla sin recargar la página, y el detalle muestra al asegurador y la fecha de la actualización.
- [x] Como asegurador, "Eliminar" pide confirmación. "Cancelar" no borra nada y "Eliminar" quita la fila de la tabla.
- [x] Como asegurado, la tabla muestra fecha, vehículo, gravedad, estado y nota de sus accidentes, sin acciones de edición. Sin accidentes muestra "Aún no has reportado accidentes".
- [x] Como asegurado, `/home` muestra un botón flotante en la esquina inferior derecha y no muestra el chat en una columna.
- [x] Hacer clic en el botón flotante abre el chat. La cruz lo cierra, y al reabrirlo la conversación sigue donde estaba.
- [x] En móvil, el chat abierto ocupa toda la pantalla y la cruz lo cierra.
- [x] Confirmar un accidente en el chat agrega la fila nueva, en "Pendiente", a la tabla del asegurado sin recargar la página.
- [x] Como asegurador, `/home` no muestra el botón flotante del chat.
- [x] Con un access token inválido en `localStorage`, abrir `/home` redirige a `/login` con el aviso "Tu sesión expiró" para ambos roles.
- [x] Las pruebas de Vitest de `AseguradorGuard`, `AccidentesService.listarMios` y el servicio de accidentes del asegurador pasan con `npm test`.
- [x] `/home` se revisó con Playwright para ambos roles en escritorio y móvil, sin errores en la consola.
- [x] `npm run lint` y `npm run build` pasan sin errores en `back-uatx-crud` y en `front-uatx-crud`.

## Decisions

- **Sí:** Dividir el pedido en dos specs. Esta cubre el CRUD del asegurador y la tabla del asegurado, que comparten modelo y endpoints. El chat de Gemini del asegurador va en la SPEC 05 porque consulta lo que esta spec define.
- **No:** Una sola spec con las tres partes. Toca demasiadas áreas a la vez.
- **Sí:** Estados `pendiente`, `en_revision`, `aprobado` y `rechazado`, con cualquier transición permitida. Es el flujo típico de un siniestro y no obliga a diseñar reglas todavía.
- **No:** Reglas de transición entre estados. Van en otra spec si se necesitan.
- **Sí:** El asegurador ve, cambia el estado, anota y elimina; no crea. Los accidentes solo nacen desde el chat del asegurado con la foto validada por Gemini.
- **No:** Que el asegurador cree accidentes. Obligaría a decidir qué pasa con la foto obligatoria y la constancia.
- **Sí:** El asegurador solo edita el estado y la nota (`nota_asegurador`). Lo que reportó el asegurado y lo que analizó Gemini quedan intactos como evidencia.
- **No:** Editar los datos del reporte.
- **Sí:** Se guarda solo la última actualización (`actualizado_por` y `fecha_actualizacion`). Basta para saber quién tocó el accidente por última vez sin una tabla extra.
- **No:** Historial completo de cambios.
- **Sí:** Borrado físico de la fila y de la foto. Primero la fila y después la foto: si falla la foto queda una foto huérfana (se registra en el log), que es menos grave que un accidente sin foto.
- **No:** Borrado lógico ni limitar el borrado a los rechazados.
- **Sí:** Solo el asegurador ve la foto, con una URL firmada de 10 minutos generada por el backend. El bucket sigue privado.
- **No:** Mostrar la foto al asegurado.
- **Sí:** Filtro por estado que arranca en "Pendiente" y búsqueda en el cliente, igual que el CRUD de asegurados de la SPEC 02. Basta para el volumen esperado.
- **No:** Pestañas por estado, paginación o búsqueda en el servidor.
- **Sí:** El CRUD de accidentes vive en `/home`, como se pidió, y `/asegurados` se conserva. Corrige la decisión de la SPEC 02 de no embeber tablas en `/home`.
- **Sí:** `/home` en dos columnas para ambos roles: "Datos personales" a la izquierda, los botones arriba de la tabla a la derecha (pedido del usuario).
- **Sí:** El chat del asegurado pasa a un botón flotante en la esquina inferior derecha con una cruz para cerrarlo (pedido del usuario). Corrige la disposición de tres columnas de la SPEC 03, que ya no deja espacio para la tabla.
- **Sí:** Cerrar el chat solo lo oculta; la conversación se conserva hasta recargar. Evita perder un reporte a medias por un clic.
- **No:** Reiniciar la conversación al cerrar, ni preguntar antes de descartarla.
- **Sí:** Panel flotante en escritorio y pantalla completa en móvil. En móvil no cabe un panel junto al contenido.
- **No:** Drawer lateral.
- **Sí:** La tabla del asegurado muestra la nota del asegurador y se recarga sola al registrar un accidente desde el chat.
- **No:** Diálogo de detalle para el asegurado.
- **Sí:** Endpoints del asegurador en un controlador aparte con `AseguradorGuard`, bajo la misma ruta `/accidentes`. El controlador de la SPEC 03 conserva `AseguradoGuard` a nivel de clase y suma `GET /accidentes/mios`.
- **Sí:** `GET /accidentes` trae los datos del asegurado en la misma respuesta. El detalle no necesita otra petición, salvo la URL firmada de la foto.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El check de `estado` tiene un nombre distinto al esperado y la migración falla | El paso 1 consulta el nombre real antes de aplicar la migración. |
| Se borra la fila pero falla el borrado de la foto y queda una foto huérfana | Se registra en el log con su `foto_path`. Aceptado: no afecta a los datos y se puede limpiar a mano. |
| Dos aseguradores editan el mismo accidente a la vez y uno sobrescribe al otro | Aceptado: gana el último `PATCH`, y el detalle muestra quién actualizó por última vez. |
| La URL firmada de la foto vence con el detalle abierto | Dura 10 minutos. Al reabrir el detalle se pide una nueva. |
| La tabla del asegurado no refleja un cambio de estado hecho mientras tiene `/home` abierta | Aceptado: lo ve al recargar o al registrar otro accidente. El tiempo real queda fuera de esta spec. |
| El botón flotante tapa la última fila de la tabla en móvil | La página deja un margen inferior del alto del botón. Se revisa con Playwright en móvil. |
| `GET /accidentes` crece con el tiempo porque trae todos los accidentes | Aceptado para el volumen del proyecto. La paginación en el servidor va en otra spec. |

## What is **not** in this spec

- Chat de Gemini para el asegurador (SPEC 05).
- Que el asegurador cree accidentes.
- Editar los datos del reporte.
- Historial de cambios de estado.
- Reglas de transición entre estados.
- Foto o detalle completo para el asegurado.
- Notificaciones al asegurado.
- Borrado lógico de accidentes.
- Paginación y búsqueda en el servidor.
- Actualización en tiempo real de las tablas.

Cada uno de estos, si se implementa, va en su propia spec.
