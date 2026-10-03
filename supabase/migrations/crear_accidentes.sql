-- Migración aplicada en Supabase (proyecto zqzqjtwmanroqcuhqois) vía MCP: crear_accidentes
-- SPEC 03 — Paso 1

-- Accidentes vehiculares reportados por los asegurados
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

-- Bucket privado para la foto de cada accidente; sin políticas: solo el backend sube y lee
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accidentes-fotos', 'accidentes-fotos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);
