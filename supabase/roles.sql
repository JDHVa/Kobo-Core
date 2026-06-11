-- ════════════════════════════════════════════════════════════════════
-- ROLES DE USUARIO: admin / member
-- Ejecutar UNA VEZ en Supabase → SQL Editor (DESPUÉS de migracion-talleres.sql)
--
-- admin : todo (muebles, borrar, papelera, kits, gestionar roles)
-- member: ver, agregar herramientas, retirar/devolver, conteos
-- El PRIMER usuario de cada taller queda como admin automáticamente.
-- ════════════════════════════════════════════════════════════════════

-- 1) Tabla de perfiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  team text not null,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

-- 2) Crear el perfil al registrarse; el primero del taller es admin
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_team text := coalesce(new.raw_user_meta_data->>'team', new.raw_app_meta_data->>'team', '');
  v_role text;
begin
  if v_team = '' then return new; end if;
  select case when exists (select 1 from public.profiles where team = v_team) then 'member' else 'admin' end into v_role;
  insert into public.profiles (id, display_name, email, team, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''), coalesce(new.email,''), v_team, v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_profile on auth.users;
create trigger trg_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Backfill: usuarios existentes (el más antiguo de cada taller = admin)
insert into public.profiles (id, display_name, email, team, role)
select u.id,
  coalesce(u.raw_user_meta_data->>'display_name',''),
  coalesce(u.email,''),
  coalesce(u.raw_app_meta_data->>'team', u.raw_user_meta_data->>'team', 'Equipo Principal'),
  case when row_number() over (
    partition by coalesce(u.raw_app_meta_data->>'team', u.raw_user_meta_data->>'team', 'Equipo Principal')
    order by u.created_at
  ) = 1 then 'admin' else 'member' end
from auth.users u
on conflict (id) do nothing;

-- 4) Helpers
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 5) RLS de profiles: ver a tu taller; solo el admin cambia roles
alter table public.profiles enable row level security;
drop policy if exists prof_select on public.profiles;
drop policy if exists prof_update on public.profiles;
create policy prof_select on public.profiles for select to authenticated
  using (team = public.current_team());
create policy prof_update on public.profiles for update to authenticated
  using (team = public.current_team() and public.is_admin())
  with check (team = public.current_team() and role in ('admin','member'));

-- 6) Endurecer permisos por rol en las tablas del inventario:
--    - muebles (containers): solo admin crea/edita/borra
--    - tools/kits: borrar solo admin; agregar/editar cualquier miembro
do $$
begin
  -- containers: reemplazar escritura por versión solo-admin
  drop policy if exists team_insert on public.containers;
  drop policy if exists team_update on public.containers;
  drop policy if exists team_delete on public.containers;
  create policy team_insert on public.containers for insert to authenticated
    with check (team = public.current_team() and public.is_admin());
  create policy team_update on public.containers for update to authenticated
    using (team = public.current_team() and public.is_admin())
    with check (team = public.current_team() and public.is_admin());
  create policy team_delete on public.containers for delete to authenticated
    using (team = public.current_team() and public.is_admin());

  -- tools / kits: borrar solo admin
  drop policy if exists team_delete on public.tools;
  create policy team_delete on public.tools for delete to authenticated
    using (team = public.current_team() and public.is_admin());
  drop policy if exists team_delete on public.kits;
  create policy team_delete on public.kits for delete to authenticated
    using (team = public.current_team() and public.is_admin());
end;
$$;
