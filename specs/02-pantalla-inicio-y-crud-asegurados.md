# SPEC 02 — Pantalla de inicio y CRUD de asegurados para el asegurador

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-26
> **Objective:** Reemplazar el placeholder de `/home` por la pantalla de inicio de la maqueta (encabezado, datos personales y botón 911) y dar al asegurador una ruta `/asegurados` con un CRUD de asegurados protegido por rol en el backend.

## Por qué existe esta spec

La SPEC 01 dejó una sesión funcional pero una `/home` vacía y ninguna forma de dar de alta asegurados sin entrar a Supabase. Esta spec cubre la pantalla de inicio común a ambos roles y la herramienta de trabajo del asegurador. El CRUD de accidentes se deja fuera porque la tabla de accidentes todavía no existe: nace con el chat de la SPEC 03.

## Scope

**In:**

- `AppHeader` (MUI `AppBar`) con el título "Aseguradora" y el botón "Cerrar sesión" (limpia store y `localStorage`, solo en el front).
- Pantalla `/home` según `references/ui/pantalla inicio.png`, para ambos roles: tarjeta "Datos personales" con avatar de iniciales y los datos del perfil del store, y botón "Llamar al 911".
- Botón "Llamar al 911" que abre un diálogo de confirmación y, al aceptar, navega a `tel:911`.
- Para el rol `asegurador`, un botón en `/home` que lleva a `/asegurados`.
- Ruta `/asegurados` (solo asegurador) con una tabla MUI de asegurados, búsqueda en el cliente por nombre/correo/`id_contrato`, y diálogos para crear, editar y eliminar.
- Endpoints `GET /asegurados`, `POST /asegurados`, `PATCH /asegurados/:id` y `DELETE /asegurados/:id` en `back-uatx-crud`, protegidos por `AseguradorGuard`.
- Alta de asegurado: el asegurador captura la contraseña inicial y el backend crea la cuenta en `auth.users` y la fila en `asegurados`.
- Edición de `nombre`, `edad`, `id_contrato`, `fecha_vencimiento` y `correo` (el correo se sincroniza en `auth.users`).
- Borrado físico: se borra la cuenta de `auth.users` y la fila cae por `ON DELETE CASCADE`.
- Manejo de sesión expirada: un 401 del CRUD cierra la sesión y redirige a `/login` con el aviso "Tu sesión expiró".

**Out of scope (for future specs):**

- Panel de chat con IA Gemini y registro de accidentes (SPEC 03). El recuadro del chat no se dibuja en esta spec.
- CRUD de accidentes (después de la SPEC 03, cuando exista su modelo).
- Administración de aseguradores (alta/edición/baja de empleados).
- Foto real del usuario (Supabase Storage o columna `foto_url`).
- Cambio o restablecimiento de contraseña desde el CRUD.
- Refresco automático del access token (`POST /auth/refresh`).
- Paginación y búsqueda en el servidor.
- Borrado lógico de asegurados.
- Edición de los propios datos personales desde `/home`.

## Data model

Esta spec no introduce tablas ni columnas nuevas. Reutiliza `public.asegurados` y `public.aseguradores` de la SPEC 01. Todas las operaciones del CRUD usan el cliente service-role (`SupabaseService.admin`), por lo que no se agregan políticas RLS.

Contratos de la API (backend `src/asegurados/`, frontend `src/asegurados/types.ts`):

```ts
// Respuesta de GET /asegurados (arreglo), POST y PATCH (un elemento)
interface Asegurado {
  id: string;               // uuid = auth.users.id
  nombre: string;
  edad: number;
  idContrato: string;
  fechaVencimiento: string; // 'YYYY-MM-DD'
  fechaRegistro: string;    // 'YYYY-MM-DD', solo lectura
  correo: string;
}

// Body de POST /asegurados (todos obligatorios)
interface CrearAseguradoDto {
  nombre: string;           // no vacío
  edad: number;             // entero positivo
  idContrato: string;       // no vacío, único
  fechaVencimiento: string; // fecha ISO 'YYYY-MM-DD'
  correo: string;           // correo válido, único
  contrasena: string;       // mínimo 6 caracteres (mínimo por defecto de Supabase Auth)
}

// Body de PATCH /asegurados/:id: los campos de CrearAseguradoDto sin contrasena, todos opcionales
type ActualizarAseguradoDto = Partial<Omit<CrearAseguradoDto, 'contrasena'>>;
```

Códigos de respuesta del CRUD:

| Caso | Código |
| --- | --- |
| Sin header `Authorization` o token inválido/expirado | 401 |
| Token válido de un asegurado (no está en `aseguradores`) | 403 |
| Body inválido (class-validator) | 400 |
| `correo` o `idContrato` ya existen | 409 |
| `:id` no existe en `asegurados` | 404 |
| `POST` exitoso | 201 |
| `DELETE` exitoso | 204 |

Conventions:

- La API expone camelCase (`idContrato`) y la tabla usa snake_case (`id_contrato`), igual que `LoginResponse` en la SPEC 01.
- `GET /asegurados` devuelve la lista completa ordenada por `nombre`.
- Los datos personales de `/home` se leen de `state.auth.perfil`; no hay endpoint nuevo para eso.

## Implementation plan

1. Backend: crear `src/auth/asegurador.guard.ts` (`AseguradorGuard`). Lee `Authorization: Bearer`, valida el token con `admin.auth.getUser(token)` y exige que el id exista en `aseguradores`. Responde 401 o 403 según la tabla de códigos. Exportarlo desde `AuthModule`. Pruebas unitarias con Vitest: sin token, token inválido, asegurado, asegurador.
2. Backend: crear `AseguradosModule` con `AseguradosController` (protegido con `AseguradorGuard`) y `AseguradosService.listar()` para `GET /asegurados`, con el mapeo snake_case → camelCase. Registrarlo en `AppModule`.
3. Backend: agregar `CrearAseguradoDto` y `AseguradosService.crear()` para `POST /asegurados`. Llama a `auth.admin.createUser` (`email_confirm: true`) e inserta la fila en `asegurados`. Si el insert falla, borra la cuenta recién creada. Traduce duplicados a 409.
4. Backend: agregar `ActualizarAseguradoDto` y `AseguradosService.actualizar()` para `PATCH /asegurados/:id`. Si cambia `correo`, primero actualiza `auth.users` con `auth.admin.updateUserById` y después la fila; si falla el update de la fila, revierte el correo en `auth.users`. 404 si no existe; 409 si hay duplicados.
5. Backend: agregar `AseguradosService.eliminar()` para `DELETE /asegurados/:id` con `auth.admin.deleteUser` (204, 404 si no existe). Pruebas unitarias de `AseguradosService` con Vitest: listar, crear (incluido el rollback), duplicado → 409, actualizar correo, eliminar inexistente → 404.
6. Frontend: crear `src/components/AppHeader.tsx` con el título "Aseguradora" y el botón "Cerrar sesión" (despacha `cerrarSesion`, borra `localStorage` y navega a `/login`).
7. Frontend: crear `src/pages/HomePage.tsx` con `DatosPersonales` (Avatar de iniciales + datos del perfil según el rol) y `BotonLlamar911` (diálogo de confirmación → `tel:911`). Para el asegurador, agregar el botón "Administrar asegurados" que lleva a `/asegurados`. Reemplazar `HomePlaceholder` en `App.tsx` y borrar `HomePlaceholder.tsx`.
8. Frontend: extender `ProtectedRoute` con una prop opcional `rol`. Si el perfil no tiene ese rol, redirige a `/home`. Agregar la ruta `/asegurados` con `rol="asegurador"` y una `AseguradosPage` que por ahora solo muestra el `AppHeader` y un título.
9. Frontend: crear `src/asegurados/api.ts` (`listar`, `crear`, `actualizar`, `eliminar` con el header `Bearer`) y `src/asegurados/types.ts`. Un 401 lanza `SesionExpiradaError`, y el llamador despacha `cerrarSesion` y navega a `/login` con `state: { aviso: 'Tu sesión expiró' }`. `LoginPage` muestra ese aviso si llega en el `state`.
10. Frontend: en `AseguradosPage`, mostrar la tabla MUI (nombre, edad, idContrato, fechaVencimiento, correo, acciones), el campo de búsqueda filtrado en el cliente y los estados de carga, vacío y error.
11. Frontend: crear `AseguradoFormDialog` (modos crear y editar; en crear pide la contraseña) y conectarlo a los botones "Nuevo asegurado" y "Editar". Muestra los errores 400/409 del backend dentro del diálogo y recarga la lista al guardar.
12. Frontend: agregar el diálogo de confirmación de "Eliminar" y recargar la lista al confirmar. Revisar `/home` y `/asegurados` con Playwright contra la maqueta (requisito de `CLAUDE.md`).

## Acceptance criteria

- [ ] `GET /asegurados` sin header `Authorization` responde 401.
- [ ] `GET /asegurados` con el token de un asegurado responde 403.
- [ ] `GET /asegurados` con el token de un asegurador responde 200 con un arreglo de `Asegurado` ordenado por `nombre`.
- [ ] `POST /asegurados` con datos válidos responde 201, y el nuevo asegurado puede iniciar sesión en `/login` con ese correo (o `idContrato`) y esa contraseña.
- [ ] `POST /asegurados` con un `correo` o `idContrato` existente responde 409 y no deja una cuenta huérfana en `auth.users`.
- [ ] `POST /asegurados` con `edad` no entera o `contrasena` de menos de 6 caracteres responde 400.
- [ ] `PATCH /asegurados/:id` que cambia `correo` responde 200, y el asegurado puede iniciar sesión con el correo nuevo pero ya no con el anterior.
- [ ] `PATCH /asegurados/:id` y `DELETE /asegurados/:id` con un id inexistente responden 404.
- [ ] `DELETE /asegurados/:id` responde 204, y la cuenta ya no existe ni en `auth.users` ni en `asegurados`.
- [ ] `/home` muestra el `AppBar` "Aseguradora", la tarjeta "Datos personales" con avatar de iniciales y el botón "Llamar al 911", con la disposición de `references/ui/pantalla inicio.png` (sin panel de chat).
- [ ] Como asegurado, "Datos personales" muestra nombre, edad, idContrato, fecha de vencimiento, fecha de registro y correo.
- [ ] Como asegurador, "Datos personales" muestra nombre, edad, idEmpleado y correo, y aparece el botón "Administrar asegurados".
- [ ] "Llamar al 911" abre un diálogo de confirmación. "Cancelar" lo cierra sin navegar y "Llamar" navega a `tel:911`.
- [ ] "Cerrar sesión" redirige a `/login`, borra la clave `uatx-sesion` de `localStorage`, y volver a `/home` redirige a `/login`.
- [ ] Un asegurado que entra a `/asegurados` es redirigido a `/home`.
- [ ] En `/asegurados`, escribir en la búsqueda filtra la tabla por nombre, correo o idContrato sin hacer peticiones nuevas.
- [ ] Crear, editar y eliminar un asegurado desde la UI actualiza la tabla sin recargar la página.
- [ ] Un 409 al guardar muestra el mensaje de error dentro del diálogo sin cerrarlo.
- [ ] Con un access token inválido en `localStorage`, abrir `/asegurados` redirige a `/login` con el aviso "Tu sesión expiró".
- [ ] Las pruebas de Vitest de `AseguradorGuard` y `AseguradosService` pasan con `npm test`.
- [ ] `/home` y `/asegurados` se revisaron con Playwright para ambos roles, sin errores en la consola.
- [ ] `npm run lint` y `npm run build` pasan sin errores en `back-uatx-crud` y en `front-uatx-crud`.

## Decisions

- **Sí:** El CRUD cubre solo asegurados. La tabla de accidentes nace en la SPEC 03 y adelantarla aquí duplicaría decisiones de modelo.
- **No:** CRUD de accidentes en esta spec, aunque la SPEC 01 lo anticipaba en la SPEC 02. Se corrige esa previsión.
- **No:** Administración de aseguradores. No se pidió y abre preguntas de permisos entre empleados.
- **Sí:** La misma `/home` para ambos roles, más una ruta `/asegurados` exclusiva del asegurador. Respeta la maqueta y separa la herramienta de trabajo.
- **No:** Una home distinta por rol ni la tabla CRUD embebida en `/home`.
- **Sí:** Avatar con iniciales en vez de foto. No requiere esquema ni Storage.
- **No:** Supabase Storage o columna `foto_url`. Van en otra spec si se necesitan.
- **Sí:** `tel:911` con diálogo de confirmación. Evita llamadas accidentales.
- **No:** Recuadro placeholder del chat. El chat completo llega en la SPEC 03.
- **Sí:** El asegurador captura la contraseña inicial al crear el asegurado (`auth.admin.createUser` con `email_confirm: true`). No depende de SMTP.
- **No:** Contraseña generada o invitación por correo.
- **Sí:** Se editan todos los campos salvo `fecha_registro` y contraseña. El correo se sincroniza en `auth.users` para que el login siga funcionando.
- **Sí:** Borrado físico vía `auth.admin.deleteUser` con cascada. Es simple mientras no haya accidentes ligados. Si la SPEC 03 los liga, esa spec debe revisar esta decisión.
- **No:** Borrado lógico. Cambiaría el esquema y el login de la SPEC 01.
- **Sí:** Tabla MUI simple con búsqueda en el cliente. Basta para decenas o pocos cientos de registros y no agrega dependencias.
- **No:** `@mui/x-data-grid` ni paginación en el servidor.
- **Sí:** `AseguradorGuard` valida el JWT con Supabase y el rol contra la tabla `aseguradores`. Ocultar el CRUD en el front no basta como seguridad.
- **Sí:** Un 401 cierra la sesión y redirige a `/login` con aviso. **No:** refresh automático del token, que va en otra spec.
- **Sí:** Botón "Cerrar sesión" en el `AppBar`. Hoy no hay forma de salir de la app.
- **Sí:** Los datos personales de `/home` salen del perfil guardado en Redux. No se agrega un endpoint `/me`.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Alta a medias: la cuenta en `auth.users` se crea pero el insert en `asegurados` falla (p. ej. `id_contrato` duplicado) | `crear()` borra la cuenta recién creada si falla el insert. Hay una prueba unitaria y un criterio de aceptación que lo cubren. |
| Edición a medias: el correo cambia en `auth.users` pero falla el update de la fila | `actualizar()` revierte el correo en `auth.users` si falla el update de la fila. |
| Los datos personales en Redux quedan desactualizados si el asegurador edita a un asegurado con sesión abierta | Aceptado: el asegurado ve los datos nuevos en su siguiente login. |
| El guard hace una llamada a Supabase Auth por cada petición | Aceptable para el volumen esperado. Se puede cambiar por verificación local del JWT en otra spec. |
| `tel:911` no hace nada en navegadores de escritorio sin una app de telefonía | Aceptado: el caso de uso real es móvil. El diálogo muestra el número para marcarlo a mano. |

## What is **not** in this spec

- Chat con IA Gemini y registro de accidentes (SPEC 03).
- CRUD de accidentes.
- Administración de aseguradores.
- Foto real del usuario.
- Cambio o restablecimiento de contraseña.
- Refresco automático del token.
- Paginación y búsqueda en el servidor.
- Borrado lógico.
- Edición de los propios datos personales.

Cada uno de estos, si se implementa, va en su propia spec.
