# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Descripción general

Espacio de trabajo para una aplicación CRUD ("uatx-crud") dividida en dos proyectos npm independientes. No hay un `package.json` en la raíz; ejecuta los comandos dentro de cada subproyecto. Ambos están recién generados: todavía no se ha implementado la lógica de negocio.

- `back-uatx-crud/` — API en NestJS 12 (TypeScript, ESM). Tiene su propio repositorio git (aún sin commits).
- `front-uatx-crud/` — SPA en React 19 + Vite 8 + MUI 9 (Emotion) (TypeScript).
- `references/ui/` — maquetas de la interfaz (`login.png`, `pantalla inicio.png`) que se deben seguir al construir las pantallas del frontend.
- `.mcp.json` — servidor MCP de Supabase vinculado al proyecto `zqzqjtwmanroqcuhqois`; Supabase es la base de datos/servicio backend previsto. Revisa las tablas existentes antes de hacer cambios de esquema.

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
npm run dev       # servidor de desarrollo de Vite
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run preview
```
El frontend no tiene configurado ningún ejecutor de pruebas.

## Convenciones del backend

- El paquete es `"type": "module"` con `module: nodenext`: **las importaciones relativas deben incluir la extensión `.js`** (p. ej. `import { AppService } from './app.service.js'`). `main.ts` usa `await` de nivel superior.
- Las pruebas usan Vitest con `globals: true` (no Jest); `vite-tsconfig-paths` resuelve los alias de rutas de tsconfig.
- `app.module.ts` conecta `@nestjs/observe` (`ObserveModule` + `ObserveInstrument`, que se pasa a `NestFactory.create`) con credenciales de ejemplo `YOUR_APP_KEY`/`YOUR_APP_SECRET`.
- El linter es oxlint (no ESLint); `no-explicit-any` está desactivada y `no-floating-promises` genera advertencia.

## Flujo de trabajo basado en specs

El espacio de trabajo instala dos skills que invoca el usuario en `.agents/skills/` (de `Klerith/fernando-skills`):
- `/spec <funcionalidad>` — diseño guiado de specs; las escribe en `specs/` usando `.agents/skills/spec/template.md`. En esta fase no se escribe código.
- `/spec-impl <NN-nombre-spec>` — implementa una spec solo si su estado es "Aprobado"; crea y cambia a una rama git con el nombre de la spec (configurable en `specs/.spec-config.yml`, `AutoCreateBranch`) e implementa paso a paso, con pausas para revisar los diffs.

Se espera que las funcionalidades grandes pasen por `/spec` antes de implementarse.
