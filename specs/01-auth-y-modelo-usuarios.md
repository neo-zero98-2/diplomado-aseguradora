# SPEC 01 — Autenticación con Supabase y modelo de datos de asegurados/aseguradores

> **Status:** Borrador
> **Depends on:** Ninguna (primera spec del proyecto)
> **Date:** 2026-09-26
> **Objective:** Implementar el login (correo o idContrato/idEmpleado + contraseña) contra Supabase Auth, con las tablas de perfil de asegurados y aseguradores, un endpoint de backend que resuelve la autenticación, y la pantalla de login en React que redirige a una ruta protegida placeholder tras iniciar sesión.

## Por qué existe esta spec

Este sistema de aseguradora requiere que tanto los asegurados (usuarios finales) como los aseguradores (empleados) inicien sesión con un formulario único, pero cada rol tiene datos distintos (contrato vs. empleado) y reglas distintas (el contrato puede vencer). Antes de construir la pantalla de inicio (SPEC 02) o el chat de IA para accidentes (SPEC 03), se necesita esta base de autenticación y modelo de datos, ya que ambas specs futuras dependen de saber quién inició sesión y con qué rol.

## Scope

**In:**

- Tablas Supabase `asegurados` y `aseguradores` con Row Level Security habilitado.
- Endpoint `POST /auth/login` en `back-uatx-crud` que acepta correo **o** idContrato/idEmpleado, más contraseña, y autentica contra Supabase Auth.
- Resolución de rol (`asegurado` o `asegurador`) según en qué tabla existe el perfil autenticado.
- Validación de contrato vencido: si `fechaVencimiento` de un asegurado ya pasó, el login se rechaza.
- Pantalla de login en `front-uatx-crud` (React + MUI) fiel a `references/ui/login.png`.
- Estado de sesión en Redux Toolkit en el frontend, hidratado desde `localStorage`.
- Ruta protegida `/home` con placeholder `"Bienvenido, {nombre}"` y redirección a `/login` si no hay sesión.

**Out of scope (for future specs):**

- Registro/alta de nuevas cuentas de asegurado o asegurador (se crean manualmente en Supabase por ahora).
- Recuperación/reseteo de contraseña.
- UI completa de la pantalla de inicio: foto, datos personales, botón de llamar al 911 (SPEC 02).
- CRUD completo del asegurador sobre usuarios y accidentes (SPEC 02).
- Chat con IA Gemini y registro de accidentes (SPEC 03).

## Data model

Esquema `public` en Supabase. Ambas tablas usan `id` como llave primaria y foránea 1:1 hacia `auth.users(id)`, de forma que el id de sesión de Supabase Auth sea directamente el id del perfil.

```sql
-- Asegurados (usuarios finales)
create table public.asegurados (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  edad integer not null,
  id_contrato text not null unique,
  fecha_vencimiento date not null,
  fecha_registro date not null default now(),
  correo text not null unique
);

-- Aseguradores (empleados)
create table public.aseguradores (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  edad integer not null,
  id_empleado text not null unique
);
```

Conventions:

- `id_contrato` e `id_empleado` son el valor que la maqueta de login llama "idUsuario" — no existe una columna `idUsuario` separada.
- El correo del asegurador no se duplica en su tabla: se obtiene de `auth.users.email` cuando se necesita.
- RLS habilitado en ambas tablas: una fila solo es visible/editable por su propio dueño (`id = auth.uid()`). El backend usa la service role key para las operaciones de login que necesitan buscar por `id_contrato`/`id_empleado` antes de que exista una sesión.

Respuesta del backend tras un login exitoso:

```ts
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  perfil:
    | { rol: 'asegurado'; nombre: string; edad: number; idContrato: string; fechaVencimiento: string; fechaRegistro: string; correo: string }
    | { rol: 'asegurador'; nombre: string; edad: number; idEmpleado: string; correo: string };
}
```

## Implementation plan

1. Crear la migración de Supabase con las tablas `asegurados` y `aseguradores`, RLS habilitado y sus políticas de "dueño de la fila" (`mcp__supabase__apply_migration`).
2. Sembrar manualmente en Supabase (vía SQL) un usuario de prueba `asegurado` y uno `asegurador` (cuenta en `auth.users` + fila de perfil), documentando las credenciales de prueba para los pasos siguientes.
3. En `back-uatx-crud`: agregar la dependencia `@supabase/supabase-js`, crear `SupabaseModule`/`SupabaseService` con un cliente anon (para `signInWithPassword`) y un cliente service-role (para las búsquedas previas al login), leyendo `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` desde variables de entorno; documentar las variables en `.env.example`.
4. Crear `AuthModule` con `LoginDto` (class-validator), `AuthController` (`POST /auth/login`) y `AuthService`: resuelve el identificador (correo si contiene `@`, si no busca `id_contrato`/`id_empleado`), valida contrato vencido, llama a Supabase Auth y arma el `LoginResponse`.
5. Escribir pruebas unitarias de `AuthService` con Vitest: login por correo, login por idContrato/idEmpleado, contrato vencido rechazado, credenciales inválidas.
6. En `front-uatx-crud`: agregar `@reduxjs/toolkit`, `react-redux` y `react-router-dom`; crear el store con un `authSlice` (accessToken, refreshToken, perfil) hidratado desde `localStorage` al inicializar.
7. Crear `LoginPage` siguiendo `references/ui/login.png` (campo correo/idUsuario, campo contraseña, botón "Aceptar") que llama a `POST /auth/login` y despacha la sesión al store.
8. Crear `ProtectedRoute` y una página `HomePlaceholder` (`"Bienvenido, {nombre}"`); configurar rutas `/login` y `/home` en `App.tsx`, con redirección a `/home` tras login y a `/login` si no hay sesión.

## Acceptance criteria

- [ ] Las tablas `asegurados` y `aseguradores` existen en Supabase con RLS habilitado.
- [ ] `POST /auth/login` con correo y contraseña válidos de un asegurado responde 200 con `accessToken`, `refreshToken` y `perfil.rol = "asegurado"`.
- [ ] `POST /auth/login` con `id_contrato` (en vez de correo) y la misma contraseña responde igual que con correo.
- [ ] `POST /auth/login` con `id_empleado` y contraseña válidos de un asegurador responde 200 con `perfil.rol = "asegurador"`.
- [ ] `POST /auth/login` de un asegurado con `fechaVencimiento` pasada responde 403 y no genera sesión.
- [ ] `POST /auth/login` con contraseña incorrecta responde 401.
- [ ] La pantalla de login en React coincide con `references/ui/login.png` (correo/idUsuario, contraseña, botón Aceptar).
- [ ] Tras un login exitoso, la sesión queda en el store de Redux, persistida en `localStorage`, y el navegador redirige a `/home` mostrando `"Bienvenido, {nombre}"`.
- [ ] Recargar `/home` con una sesión guardada en `localStorage` mantiene al usuario autenticado (no redirige a `/login`).
- [ ] Acceder a `/home` sin sesión redirige a `/login`.
- [ ] `npm run lint` y `npm run build` pasan sin errores en `back-uatx-crud` y en `front-uatx-crud`.

## Decisions

- **Sí:** Supabase Auth para autenticación en vez de una tabla de contraseñas propia. Evita manejar hashing y tokens a mano.
- **Sí:** El backend NestJS es el único que habla con Supabase Auth (el frontend nunca ve las claves de Supabase). Decisión explícita del usuario; centraliza credenciales en el servidor.
- **Sí:** Dos tablas separadas (`asegurados`, `aseguradores`) en vez de una tabla con columna `rol`. Los campos difieren (`id_contrato`/`fecha_vencimiento` vs. `id_empleado`) y evita columnas nullable.
- **Sí:** El "idUsuario" de la maqueta de login es `id_contrato`/`id_empleado` según el rol; no se crea una columna nueva.
- **Sí:** Redux Toolkit para el estado de sesión en el frontend, hidratado manualmente desde `localStorage` al arrancar la app (sin `redux-persist`). Pedido explícito del usuario; evita una dependencia adicional para un caso simple.
- **Sí:** `react-router-dom` para las rutas `/login` y `/home`. El proyecto todavía no tiene enrutador y se necesita para la ruta protegida.
- **Sí:** Un contrato vencido bloquea el login del asegurado (403). Decisión explícita del usuario.
- **No:** Registro/alta de cuentas nuevas desde la app. Fuera de alcance; las cuentas se crean manualmente en Supabase por ahora.
- **No:** Recuperación/reseteo de contraseña. No se mencionó como necesidad; se deja para una spec futura si se llega a necesitar.
- **No:** UI completa de la pantalla de inicio (foto, botón 911, chat con Gemini). Es la SPEC 02 y la SPEC 03.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Ambigüedad si un `id_contrato`/`id_empleado` tuviera forma de correo | Se decide por la presencia de `@`: si el identificador contiene `@` se trata como correo; si no, se busca como `id_contrato`/`id_empleado`. |
| La service role key queda expuesta por error | Vive solo en el backend (`.env`, fuera de git); el frontend nunca la recibe ni la referencia. |
| Comparación de `fechaVencimiento` con reloj desalineado | Se compara contra la fecha actual del servidor Node/Postgres al momento del login, suficiente para el alcance de esta spec. |

## What is **not** in this spec

- Registro/alta de nuevas cuentas de asegurado o asegurador.
- Recuperación de contraseña.
- UI completa de la pantalla de inicio: datos personales, foto, botón de llamar al 911 (SPEC 02).
- CRUD completo del asegurador sobre usuarios y accidentes (SPEC 02).
- Chat con IA Gemini y registro de accidentes: fotos, ubicación, persistencia del accidente (SPEC 03).

Cada uno de estos, si se implementa, va en su propia spec.
