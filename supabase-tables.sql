-- ============================================================
-- MiApp: tablas para Supabase (SQL Editor)
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ============================================================

-- Tabla "rooms": representa un plan / sala de coordinación
create table if not exists public.rooms (
  id     text primary key,          -- usamos el código de invitación como id
  code   text not null unique,      -- código para compartir (ej: A1B2C3)
  name   text not null,
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
