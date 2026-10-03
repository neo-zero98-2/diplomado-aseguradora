-- Migración aplicada en Supabase (proyecto zqzqjtwmanroqcuhqois) vía MCP: gestion_accidentes
-- SPEC 04 — Paso 1

-- Estados con los que el asegurador da seguimiento a cada accidente
alter table public.accidentes drop constraint accidentes_estado_check;
alter table public.accidentes add constraint accidentes_estado_check
  check (estado in ('pendiente', 'en_revision', 'aprobado', 'rechazado'));

-- Nota del asegurador y última actualización (sin historial)
alter table public.accidentes
  add column nota_asegurador text check (char_length(nota_asegurador) <= 1000),
  add column actualizado_por uuid references public.aseguradores(id) on delete set null,
  add column fecha_actualizacion timestamptz;
