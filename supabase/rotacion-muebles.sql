-- Rotación de muebles en el mapa (pasos de 90°)
-- Ejecutar UNA VEZ en Supabase → SQL Editor
alter table public.containers add column if not exists rotation integer not null default 0;
