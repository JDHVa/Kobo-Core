-- ════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: un inventario separado por taller (clave maestra)
-- Ejecutar UNA VEZ en Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════════════

-- 1) Columna "team" en todas las tablas del inventario
alter table public.containers   add column if not exists team text;
alter table public.tools        add column if not exists team text;
alter table public.custom_icons add column if not exists team text;
alter table public.transactions add column if not exists team text;
alter table public.kits         add column if not exists team text;

-- 2) Todo lo que ya existe pertenece al taller original
update public.containers   set team = 'Equipo Principal' where team is null;
update public.tools        set team = 'Equipo Principal' where team is null;
update public.custom_icons set team = 'Equipo Principal' where team is null;
update public.transactions set team = 'Equipo Principal' where team is null;
update public.kits         set team = 'Equipo Principal' where team is null;

-- 3) Copiar el equipo a app_metadata al crear cada cuenta.
--    user_metadata lo puede editar el propio usuario desde el navegador;
--    app_metadata no. Por eso las políticas RLS leen app_metadata.
create or replace function public.sync_team_to_app_metadata()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.raw_user_meta_data ? 'team' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('team', new.raw_user_meta_data->>'team');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_team on auth.users;
create trigger trg_sync_team
  before insert on auth.users
  for each row execute function public.sync_team_to_app_metadata();

-- Usuarios ya existentes: copiar su equipo (o asignarles el original)
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('team', coalesce(raw_user_meta_data->>'team', 'Equipo Principal'))
where raw_app_meta_data->>'team' is null;

-- 4) Helper: el taller del usuario autenticado (desde su JWT)
create or replace function public.current_team()
returns text
language sql stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'team', '');
$$;

-- 5) Políticas RLS: cada taller solo ve y toca SUS filas.
--    Se eliminan las políticas anteriores de estas tablas y se crean
--    las nuevas por equipo.
do $$
declare
  p record;
  t text;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('containers','tools','custom_icons','transactions','kits')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;

  foreach t in array array['containers','tools','custom_icons','transactions','kits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy team_select on public.%I for select to authenticated using (team = public.current_team())', t);
    execute format('create policy team_insert on public.%I for insert to authenticated with check (team = public.current_team())', t);
    execute format('create policy team_update on public.%I for update to authenticated using (team = public.current_team()) with check (team = public.current_team())', t);
    execute format('create policy team_delete on public.%I for delete to authenticated using (team = public.current_team())', t);
  end loop;
end;
$$;

-- 6) ⚠️ REVISAR: la función adjust_tool_qty.
--    Si fue creada como SECURITY DEFINER, se salta el RLS y un usuario
--    podría modificar herramientas de otro taller. Para ver su código:
--      select pg_get_functiondef(oid) from pg_proc where proname = 'adjust_tool_qty';
--    Si es SECURITY DEFINER, agrega a su UPDATE la condición:
--      and team = public.current_team()
--    Si no lo es, no hay que hacer nada (el RLS ya la limita).
