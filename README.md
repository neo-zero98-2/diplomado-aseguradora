# uatx-crud

Aplicación web para una aseguradora que conecta a **asegurados** y **aseguradores** alrededor del reporte y la gestión de accidentes vehiculares, con asistencia de IA (Google Gemini).

- **Asegurado:** reporta un accidente desde un chat guiado por Gemini (sube una foto que la IA valida, comparte su ubicación y confirma sus datos) y consulta el estado de sus reportes en una tabla.
- **Asegurador:** administra a los asegurados (CRUD), revisa los accidentes (cambia el estado, agrega notas, elimina) y le pregunta a un chat con Gemini por los accidentes ("¿cuántos graves siguen pendientes?", "¿qué accidentes tiene Juan Pérez?"). Gemini no inventa cifras: consulta herramientas del backend que calculan los datos en Supabase.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19, Vite 8, MUI 9, Redux Toolkit, React Router 7, TypeScript |
| Backend | NestJS 12 (ESM), class-validator, Vitest, oxlint |
| Datos y auth | Supabase (Auth, Postgres con RLS, Storage) |
| IA | Google Gemini (`@google/genai`) con salida estructurada y function calling |

## Estructura

```
.
├── back-uatx-crud/      API NestJS (auth, asegurados, accidentes, gemini, supabase)
├── front-uatx-crud/     SPA React (login, inicio, asegurados, chats y tablas de accidentes)
├── supabase/
│   ├── migrations/      tablas, políticas RLS y Storage
│   └── seed/            usuarios de prueba
├── specs/               especificaciones 01–05 de cada funcionalidad
└── references/ui/       maquetas de la interfaz
```

## Requisitos

- Node.js 22 o superior (el backend usa `process.loadEnvFile()` y `await` de nivel superior).
- Un proyecto de Supabase.
- Una API key de Gemini ([Google AI Studio](https://aistudio.google.com/apikey)).

## Puesta en marcha

### 1. Base de datos

En el SQL Editor de Supabase ejecuta, en este orden:

1. `supabase/migrations/crear_asegurados_y_aseguradores.sql`
2. `supabase/migrations/crear_accidentes.sql`
3. `supabase/migrations/gestion_accidentes.sql`
4. (Opcional) `supabase/seed/usuarios-prueba.sql` para crear los usuarios de prueba.

### 2. Backend

```bash
cd back-uatx-crud
npm install
cp .env.example .env     # y completa los valores
npm run start:dev        # http://localhost:3000
```

| Variable | Descripción |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_ANON_KEY` | Clave anon (login de usuarios) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role. **Solo backend** |
| `GEMINI_API_KEY` | API key de Gemini. **Solo backend** |
| `GEMINI_MODEL` | Modelo con soporte de imágenes y salida estructurada (p. ej. `gemini-2.5-flash`) |
| `CONSTANCIA_SECRET` | Secreto HMAC para firmar las fotos ya validadas por la IA |
| `PORT` | Puerto de la API (por defecto `3000`) |
| `CORS_ORIGIN` | Origen permitido del frontend (por defecto `http://localhost:5173`) |

Sin `GEMINI_API_KEY`/`GEMINI_MODEL` la API arranca, pero las rutas de accidentes que usan IA responden `503`.

Para generar `CONSTANCIA_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

### 3. Frontend

```bash
cd front-uatx-crud
npm install
npm run dev              # http://localhost:5173
```

Si el backend no corre en `http://localhost:3000`, copia `.env.example` a `.env` y ajusta `VITE_API_URL`.

### Usuarios de prueba

Si ejecutaste el seed, puedes entrar con el correo o con el identificador:

| Rol | Correo | Identificador | Contraseña |
| --- | --- | --- | --- |
| Asegurado | `asegurado.prueba@example.com` | `CTR-0001` | `Prueba123!` |
| Asegurador | `asegurador.prueba@example.com` | `EMP-0001` | `Prueba123!` |

> Son credenciales solo para desarrollo. No ejecutes el seed en un proyecto de producción.

## API

Todas las rutas, salvo el login, requieren `Authorization: Bearer <access_token>` de Supabase.

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| POST | `/auth/login` | — | Login con correo, `idContrato` o `idEmpleado` |
| GET / POST | `/asegurados` | Asegurador | Listar / crear asegurados |
| PATCH / DELETE | `/asegurados/:id` | Asegurador | Editar / eliminar un asegurado |
| POST | `/accidentes/chat` | Asegurado | Turno del chat de registro |
| POST | `/accidentes/foto` | Asegurado | Validar la foto del accidente con Gemini |
| POST | `/accidentes` | Asegurado | Guardar el accidente (estado `pendiente`) |
| GET | `/accidentes/mios` | Asegurado | Accidentes propios |
| GET | `/accidentes` | Asegurador | Todos los accidentes |
| GET | `/accidentes/:id` · `/accidentes/:id/foto` | Asegurador | Detalle y foto |
| PATCH / DELETE | `/accidentes/:id` | Asegurador | Cambiar estado o nota / eliminar |
| POST | `/accidentes/consulta` | Asegurador | Chat de consulta de accidentes |

Estados de un accidente: `pendiente`, `en_revision`, `aprobado`, `rechazado`.

## Scripts

**Backend** (`back-uatx-crud/`)

```bash
npm run start:dev   # desarrollo con recarga
npm run build       # compila a dist/
npm run lint        # oxlint
npm test            # pruebas unitarias (Vitest)
npm run test:e2e    # pruebas e2e
npm run test:cov    # cobertura
```

**Frontend** (`front-uatx-crud/`)

```bash
npm run dev         # servidor de desarrollo
npm run build       # tsc -b && vite build
npm run lint        # oxlint
npm run preview     # sirve el build
```

## Seguridad

- Los archivos `.env` están en `.gitignore`; solo se versionan los `.env.example`, sin valores.
- La service role key de Supabase y la API key de Gemini viven únicamente en el backend. Nunca uses el prefijo `VITE_` para un secreto: todo lo que lo lleve termina en el bundle público del frontend.
- Los permisos por rol se aplican en el backend (`AseguradoGuard`, `AseguradorGuard`) además de las políticas RLS de Supabase.

## Flujo de trabajo

Cada funcionalidad se diseña primero como spec en `specs/` (`/spec`) y luego se implementa en su propia rama `spec-NN-nombre` (`/spec-impl`). Consulta `CLAUDE.md` para las convenciones del proyecto.
