-- ════════════════════════════════════════════════════════════════════
-- ACTUALIZACIÓN V2: fotos, lista de deseos, rol visitante y entrada del mapa
-- Ejecutar UNA VEZ en Supabase → SQL Editor (DESPUÉS de roles.sql)
--
-- Todo es ADITIVO: no borra ni modifica datos existentes.
--   1) Columna photo_url en tools (foto opcional de la herramienta)
--   2) Tabla wishlist (materiales a futuro)
--   3) Tabla map_settings (posición de la entrada del taller)
--   4) Rol "visitante": solo lectura (las políticas lo refuerzan)
--   5) Bucket de Storage "fotos" para subir imágenes
-- ════════════════════════════════════════════════════════════════════

-- 1) Foto opcional de herramienta
alter table public.tools add column if not exists photo_url text not null default '';

-- 2) Materiales a futuro (lista de deseos del taller)
create table if not exists public.wishlist (
  id text primary key,
  name text not null,
  price numeric,
  qty integer not null default 1,
  url text not null default '',
  photo_url text not null default '',
  note text not null default '',
  team text not null,
  created_at timestamptz not null default now()
);

-- Si ya habías ejecutado este archivo antes de que existiera qty,
-- esta línea agrega la columna sin tocar lo demás (es seguro re-ejecutar
-- el archivo completo: todo es idempotente).
alter table public.wishlist add column if not exists qty integer not null default 1;

-- 3) Ajustes del mapa por taller (por ahora: posición de la entrada)
create table if not exists public.map_settings (
  team text primary key,
  entrance jsonb not null default '{"wall":"bottom","offset":440,"size":120}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 4) Rol visitante: ampliar el check de profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','member','visitante'));

-- Helper: ¿puede escribir? (admin o member; el visitante NO)
create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','member')
  );
  -- Usuarios sin perfil (tabla profiles vacía / cuentas viejas) no pasan
  -- este check; roles.sql ya hace backfill de todos los usuarios.
$$;

-- El admin también puede asignar el rol visitante
drop policy if exists prof_update on public.profiles;
create policy prof_update on public.profiles for update to authenticated
  using (team = public.current_team() and public.is_admin())
  with check (team = public.current_team() and role in ('admin','member','visitante'));

-- 5) RLS de wishlist: ver todo el taller; escribir admin/member; borrar solo admin
alter table public.wishlist enable row level security;
drop policy if exists wish_select on public.wishlist;
drop policy if exists wish_insert on public.wishlist;
drop policy if exists wish_update on public.wishlist;
drop policy if exists wish_delete on public.wishlist;
create policy wish_select on public.wishlist for select to authenticated
  using (team = public.current_team());
create policy wish_insert on public.wishlist for insert to authenticated
  with check (team = public.current_team() and public.is_member());
create policy wish_update on public.wishlist for update to authenticated
  using (team = public.current_team() and public.is_member())
  with check (team = public.current_team() and public.is_member());
create policy wish_delete on public.wishlist for delete to authenticated
  using (team = public.current_team() and public.is_admin());

-- 6) RLS de map_settings: ver el taller; escribir solo admin
alter table public.map_settings enable row level security;
drop policy if exists map_select on public.map_settings;
drop policy if exists map_insert on public.map_settings;
drop policy if exists map_update on public.map_settings;
create policy map_select on public.map_settings for select to authenticated
  using (team = public.current_team());
create policy map_insert on public.map_settings for insert to authenticated
  with check (team = public.current_team() and public.is_admin());
create policy map_update on public.map_settings for update to authenticated
  using (team = public.current_team() and public.is_admin())
  with check (team = public.current_team() and public.is_admin());

-- 7) Bloquear escritura al visitante en las tablas existentes
--    (se recrean las políticas de escritura agregando is_member()).
do $$
declare t text;
begin
  -- tools / custom_icons / kits: insertar y actualizar requiere is_member
  foreach t in array array['tools','custom_icons','kits'] loop
    execute format('drop policy if exists team_insert on public.%I', t);
    execute format('create policy team_insert on public.%I for insert to authenticated with check (team = public.current_team() and public.is_member())', t);
    execute format('drop policy if exists team_update on public.%I', t);
    execute format('create policy team_update on public.%I for update to authenticated using (team = public.current_team() and public.is_member()) with check (team = public.current_team() and public.is_member())', t);
  end loop;
  -- transactions: insertar requiere is_member
  drop policy if exists team_insert on public.transactions;
  create policy team_insert on public.transactions for insert to authenticated
    with check (team = public.current_team() and public.is_member());
  -- custom_icons: borrar requiere is_member (tools/kits/containers ya son solo-admin)
  drop policy if exists team_delete on public.custom_icons;
  create policy team_delete on public.custom_icons for delete to authenticated
    using (team = public.current_team() and public.is_member());
end;
$$;

-- 8) Realtime para la wishlist (ignora el error si ya estaba agregada)
do $$
begin
  alter publication supabase_realtime add table public.wishlist;
exception when duplicate_object then null;
end;
$$;

-- 9) Bucket de Storage para fotos (herramientas y wishlist)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists fotos_read on storage.objects;
drop policy if exists fotos_insert on storage.objects;
drop policy if exists fotos_update on storage.objects;
drop policy if exists fotos_delete on storage.objects;
create policy fotos_read on storage.objects for select to public
  using (bucket_id = 'fotos');
create policy fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_member());
create policy fotos_update on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.is_member());
create policy fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_member());
