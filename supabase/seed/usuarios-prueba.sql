-- SPEC 01 — Paso 2: usuarios de prueba (asegurado + asegurador)
--
-- Credenciales de prueba (solo para desarrollo):
--   Asegurado   correo: asegurado.prueba@example.com   id_contrato: CTR-0001   contraseña: Prueba123!
--   Asegurador  correo: asegurador.prueba@example.com  id_empleado: EMP-0001   contraseña: Prueba123!
--
-- Crea la cuenta en auth.users (+ auth.identities, necesaria para login con email/contraseña)
-- y su fila de perfil. Es idempotente respecto a los correos: si ya existen, no hace nada.

do $$
declare
  v_asegurado uuid := gen_random_uuid();
  v_asegurador uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email in ('asegurado.prueba@example.com', 'asegurador.prueba@example.com')) then
    raise notice 'Los usuarios de prueba ya existen; no se hace nada.';
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_asegurado, 'authenticated', 'authenticated',
     'asegurado.prueba@example.com', extensions.crypt('Prueba123!', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_asegurador, 'authenticated', 'authenticated',
     'asegurador.prueba@example.com', extensions.crypt('Prueba123!', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (v_asegurado::text, v_asegurado,
     jsonb_build_object('sub', v_asegurado::text, 'email', 'asegurado.prueba@example.com', 'email_verified', true),
     'email', now(), now(), now()),
    (v_asegurador::text, v_asegurador,
     jsonb_build_object('sub', v_asegurador::text, 'email', 'asegurador.prueba@example.com', 'email_verified', true),
     'email', now(), now(), now());

  insert into public.asegurados (id, nombre, edad, id_contrato, fecha_vencimiento, correo)
  values (v_asegurado, 'Juan Pérez', 35, 'CTR-0001', '2027-12-31', 'asegurado.prueba@example.com');

  insert into public.aseguradores (id, nombre, edad, id_empleado)
  values (v_asegurador, 'María López', 42, 'EMP-0001');
end $$;
