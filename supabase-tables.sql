-- ============================================================
-- MiApp: tablas para Supabase (SQL Editor)
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ============================================================

-- Agregar columnas de configuración a salas ya existentes
alter table if exists public.rooms
  add column if not exists from_date    date,
  add column if not exists to_date      date,
  add column if not exists start_hour   int,
  add column if not exists end_hour     int,
  add column if not exists duration_idx int,
  add column if not exists period_idx   int,
  add column if not exists group_size   int;

-- Tabla "rooms": representa un plan / sala de coordinación
create table if not exists public.rooms (
  id     text primary key,          -- usamos el código de invitación como id
  code   text not null unique,      -- código para compartir (ej: A1B2C3)
  name   text not null,
  from_date     date,               -- rango de fechas del plan (compartido)
  to_date       date,
  start_hour    int,                -- franja horaria del plan (ej: 7-11)
  end_hour      int,
  duration_idx  int,
  period_idx    int,
  group_size    int,                -- cupo de integrantes (ej: 2)
  created_at timestamptz not null default now()
);

-- Tabla "participants": integrantes de un plan
create table if not exists public.participants (
  id         uuid primary key default gen_random_uuid(),
  room_id    text not null references public.rooms(id) on delete cascade,
  user_id    uuid null,             -- si el usuario tiene cuenta (auth.users)
  guest_name text null,             -- nombre de invitado (sin cuenta)
  created_at timestamptz not null default now()
);

-- Índice para consultar participantes por plan
create index if not exists idx_participants_room
  on public.participants (room_id);

-- Evitar participantes duplicados por sala (misma identidad: cuenta o nombre de invitado)
create unique index if not exists idx_participants_unique_identity
  on public.participants (room_id, coalesce(user_id, guest_name));

-- ============================================================
-- RLS (Row Level Security): habilitar seguridad
-- ============================================================
alter table public.rooms        enable row level security;
alter table public.participants enable row level security;

-- Políticas "lectura autenticada" (opcional). Para desarrollo puedes
-- comentarlas y desactivar RLS, o abrir con "para todos" como abajo.

-- Permitir lectura pública de planes (para que cualquiera se una con el código)
create policy "rooms_read_all"
  on public.rooms for select
  using (true);

-- Permitir crear planes a cualquiera (toca ajustar si quieres solo autenticados)
create policy "rooms_insert_all"
  on public.rooms for insert
  with check (true);

-- Permitir lectura pública de participantes
create policy "participants_read_all"
  on public.participants for select
  using (true);

-- Permitir insertar participantes a cualquiera (para unirse)
create policy "participants_insert_all"
  on public.participants for insert
  with check (true);
