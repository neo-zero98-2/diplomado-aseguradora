# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Descripción general

Aplicación ("uatx-crud") para una aseguradora: los **asegurados** reportan accidentes vehiculares mediante un chat con Gemini (con foto validada por la IA y ubicación) y los **aseguradores** gestionan asegurados y accidentes, y consultan los accidentes mediante otro chat con Gemini. Son dos proyectos npm independientes; no hay `package.json` en la raíz, así que los comandos se ejecutan dentro de cada subproyecto.

- `back-uatx-crud/` — API en NestJS 12 (TypeScript, ESM). Habla con Supabase (Auth, Postgres, Storage) y con Gemini (`@google/genai`).
- `front-uatx-crud/` — SPA en React 19 + Vite 8 + MUI 9 (Emotion), Redux Toolkit y React Router 7 (TypeScript).
- `supabase/migrations/` — SQL de las tablas (`asegurados`, `aseguradores`, `accidentes`), RLS y Storage. `supabase/seed/usuarios-prueba.sql` crea los usuarios de prueba.
- `specs/` — specs 01–05 (todas en estado "Implementado"); son la mejor fuente para entender el porqué de cada funcionalidad.
- `references/ui/` — maquetas de la interfaz (`login.png`, `pantalla inicio.png`) que deben seguirse al construir pantallas.
- `.mcp.json` — servidor MCP de Supabase vinculado al proyecto `zqzqjtwmanroqcuhqois`. Revisa las tablas existentes antes de hacer cambios de esquema y guarda cada migración nueva también en `supabase/migrations/`.

## Arquitectura

### Backend (`back-uatx-crud/src/`)
- `supabase/` — `SupabaseService` expone dos clientes: `anon` (login con `signInWithPassword`) y `admin` (service role, omite RLS; solo servidor).
- `auth/` — `POST /auth/login` (por correo, `idContrato` o `idEmpleado`). `AseguradoGuard` y `AseguradorGuard` validan el access token de Supabase (`Authorization: Bearer`) y comprueban el rol consultando su tabla; dejan el id en la petición.
- `asegurados/` — CRUD de asegurados, solo para aseguradores (`/asegurados`).
- `accidentes/` — dos controladores sobre `/accidentes`:
  - asegurado: `GET /mios`, `POST /` (guardar), `POST /chat` (chat de registro), `POST /foto` (análisis de la foto).
  - asegurador: `GET /`, `GET /:id`, `GET /:id/foto`, `PATCH /:id`, `DELETE /:id`, `POST /consulta` (chat de consulta con function calling; `herramientas-asegurador.ts` define las herramientas que calculan los datos).
  - `constancia.ts` firma con HMAC (`CONSTANCIA_SECRET`) la foto que Gemini ya validó, para que `POST /accidentes` no tenga que volver a analizarla.
- `gemini/` — `GeminiService`; si faltan `GEMINI_API_KEY`/`GEMINI_MODEL` el backend arranca pero las rutas de `/accidentes` que usan IA responden 503.
- `main.ts` carga `.env` con `process.loadEnvFile()` si existe, habilita CORS (`CORS_ORIGIN`) y un `ValidationPipe` global con `whitelist: true`.

### Frontend (`front-uatx-crud/src/`)
- Rutas en `App.tsx`: `/login`, `/home` (protegida) y `/asegurados` (solo asegurador) mediante `routes/ProtectedRoute.tsx`.
- Sesión en Redux Toolkit (`store/authSlice.ts`), hidratada manualmente desde `localStorage`; `auth/useSesionExpirada.ts` cierra la sesión ante un 401.
- `api/peticion.ts` centraliza el `fetch` con el token; la URL base es `VITE_API_URL` (por defecto `http://localhost:3000`).
- Organización por dominio: `auth/`, `asegurados/`, `accidentes/` (tablas, diálogos, chats), `components/`, `pages/`.

## Variables de entorno

- Backend: copia `back-uatx-crud/.env.example` a `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `CONSTANCIA_SECRET`, `PORT`, `CORS_ORIGIN`).
- Frontend: `front-uatx-crud/.env.example` (`VITE_API_URL`). **Nunca** pongas claves de Supabase service role ni de Gemini en el frontend: todo lo que empieza con `VITE_` termina en el bundle público.
- Los `.env` están en `.gitignore`; solo se versionan los `.env.example` y sin valores secretos.

## Comandos

### Backend (`back-uatx-crud/`)
```bash
npm run start:dev        # modo watch (puerto desde $PORT, por defecto 3000)
npm run build            # nest build -> dist/
npm run lint             # oxlint src/ test/
npm run format           # prettier
npm test                 # pruebas unitarias con vitest (**/*.spec.ts)
npx vitest run src/app.controller.spec.ts   # un solo archivo de prueba
npx vitest run -t "nombre de la prueba"     # una sola prueba por nombre
npm run test:e2e         # vitest con vitest.config.e2e.ts (**/*.e2e-spec.ts en test/)
npm run test:cov
```

### Frontend (`front-uatx-crud/`)
```bash
npm run dev       # servidor de desarrollo de Vite (http://localhost:5173)
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run preview
```
El frontend no tiene configurado ningún ejecutor de pruebas; los cambios de UI se verifican con Playwright (ver abajo).

## Convenciones del backend

- El paquete es `"type": "module"` con `module: nodenext`: **las importaciones relativas deben incluir la extensión `.js`** (p. ej. `import { AppService } from './app.service.js'`). `main.ts` usa `await` de nivel superior.
- Las pruebas usan Vitest con `globals: true` (no Jest); `vite-tsconfig-paths` resuelve los alias de rutas de tsconfig. Los servicios se prueban con dobles de `SupabaseService`/`GeminiService`, sin red.
- `app.module.ts` conecta `@nestjs/observe` (`ObserveModule` + `ObserveInstrument`, que se pasa a `NestFactory.create`) con credenciales de ejemplo `YOUR_APP_KEY`/`YOUR_APP_SECRET`; si se configuran de verdad, deben venir de variables de entorno, no del código.
- El linter es oxlint (no ESLint); `no-explicit-any` está desactivada y `no-floating-promises` genera advertencia.
- El código, los comentarios y los mensajes al usuario están en español.

## Flujo de trabajo basado en specs

El espacio de trabajo instala dos skills que invoca el usuario en `.agents/skills/` (de `Klerith/fernando-skills`):
- `/spec <funcionalidad>` — diseño guiado de specs; las escribe en `specs/` usando `.agents/skills/spec/template.md`. En esta fase no se escribe código.
- `/spec-impl <NN-nombre-spec>` — implementa una spec solo si su estado es "Aprobado"; crea y cambia a una rama git `spec-NN-nombre` (configurable en `specs/.spec-config.yml`, `AutoCreateBranch`) e implementa paso a paso, con pausas para revisar los diffs. Al terminar, la rama se fusiona en `master`.

Se espera que las funcionalidades grandes pasen por `/spec` antes de implementarse.

## MCP

Si vas a realizar cambios en el front o en la UI, asegúrate de revisarlos con Playwright (servidor MCP `playwright`). Las capturas quedan en `.playwright-mcp/`, que está ignorado por git.


