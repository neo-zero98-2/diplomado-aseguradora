-- Migración aplicada en Supabase (proyecto zqzqjtwmanroqcuhqois) vía MCP: crear_asegurados_y_aseguradores
-- SPEC 01 — Paso 1

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

alter table public.asegurados enable row level security;
alter table public.aseguradores enable row level security;

-- Políticas de "dueño de la fila": cada usuario solo ve y edita su propio perfil
create policy "asegurados_select_propio" on public.asegurados
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "asegurados_update_propio" on public.asegurados
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "aseguradores_select_propio" on public.aseguradores
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "aseguradores_update_propio" on public.aseguradores
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
