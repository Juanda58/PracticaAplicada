-- Electrolineras JAMB · esquema inicial para Supabase
-- Ejecutar en Supabase SQL Editor después de crear el proyecto.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('usuario', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.station_status as enum ('disponible', 'ocupada', 'mantenimiento');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reservation_status as enum ('pendiente', 'confirmada', 'rechazada', 'completada', 'no cumplida');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role public.user_role not null default 'usuario',
  plan text not null default 'JAMB Básico',
  vehicle_brand text,
  vehicle_model text,
  connector_type text default 'Tipo 2 (AC)',
  battery_capacity_kwh numeric(8,2),
  total_charges integer not null default 0,
  kwh_consumed numeric(10,2) not null default 0,
  co2_avoided_kg numeric(10,2) not null default 0,
  preferences jsonb not null default '{"weeklyGoalKwh":45,"notifications":true,"favoriteStationIds":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  distance_km numeric(8,2) default 0,
  status public.station_status not null default 'disponible',
  price_per_kwh integer not null default 0,
  rating numeric(2,1) not null default 4.5 check (rating between 0 and 5),
  amenities text[] not null default '{}',
  notes text,
  active_vehicles integer not null default 0,
  waiting_vehicles integer not null default 0,
  avg_wait_min integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.station_connectors (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  connector_type text not null,
  power text not null,
  available integer not null default 0 check (available >= 0),
  total integer not null default 0 check (total >= 0),
  unique (station_id, connector_type)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete restrict,
  connector_type text not null,
  reservation_date date not null,
  reservation_hour time not null,
  target_kwh numeric(8,2) not null default 10,
  estimated_cost integer not null default 0,
  payment_method text not null,
  payment_status text not null default 'pagado',
  status public.reservation_status not null default 'pendiente',
  penalty_cop integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  amount_cop integer not null,
  method text not null,
  status text not null default 'pagado',
  provider_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.charging_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  connector_type text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_min integer,
  kwh numeric(8,2) not null default 0,
  cost_cop integer not null default 0,
  status text not null default 'en_curso'
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  station_id uuid references public.stations(id) on delete set null,
  station_name text not null,
  activity_date timestamptz not null default now(),
  kwh numeric(8,2) not null default 0,
  cost_cop integer not null default 0,
  duration_min integer not null default 0
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  detail text,
  tone text not null default 'ink',
  created_at timestamptz not null default now()
);

create index if not exists reservations_user_date_idx on public.reservations(user_id, reservation_date, reservation_hour);
create index if not exists reservations_status_idx on public.reservations(status);
create index if not exists connectors_station_idx on public.station_connectors(station_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'Usuario'), '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.stations enable row level security;
alter table public.station_connectors enable row level security;
alter table public.reservations enable row level security;
alter table public.payments enable row level security;
alter table public.charging_sessions enable row level security;
alter table public.activity enable row level security;
alter table public.sponsors enable row level security;
alter table public.audit_logs enable row level security;

-- Lectura pública autenticada del catálogo y patrocinadores.
drop policy if exists "authenticated can read stations" on public.stations;
create policy "authenticated can read stations" on public.stations for select to authenticated using (true);
drop policy if exists "authenticated can read connectors" on public.station_connectors;
create policy "authenticated can read connectors" on public.station_connectors for select to authenticated using (true);
drop policy if exists "authenticated can read active sponsors" on public.sponsors;
create policy "authenticated can read active sponsors" on public.sponsors for select to authenticated using (active = true);

-- El usuario solo gestiona su perfil, reservas, pagos, sesiones y actividad.
drop policy if exists "user reads own profile" on public.profiles;
create policy "user reads own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "user updates own profile" on public.profiles;
create policy "user updates own profile" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists "user reads own reservations" on public.reservations;
create policy "user reads own reservations" on public.reservations for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "user creates own reservations" on public.reservations;
create policy "user creates own reservations" on public.reservations for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "user updates own reservations" on public.reservations;
create policy "user updates own reservations" on public.reservations for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "user deletes own reservations" on public.reservations;
create policy "user deletes own reservations" on public.reservations for delete to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "user reads own payments" on public.payments;
create policy "user reads own payments" on public.payments for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "user reads own sessions" on public.charging_sessions;
create policy "user reads own sessions" on public.charging_sessions for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "user reads own activity" on public.activity;
create policy "user reads own activity" on public.activity for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "user creates own activity" on public.activity;
create policy "user creates own activity" on public.activity for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "user updates own activity" on public.activity;
create policy "user updates own activity" on public.activity for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- El admin administra la red y consulta la operación completa.
drop policy if exists "admin manages stations" on public.stations;
create policy "admin manages stations" on public.stations for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin manages connectors" on public.station_connectors;
create policy "admin manages connectors" on public.station_connectors for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin manages reservations" on public.reservations;
create policy "admin manages reservations" on public.reservations for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin manages sponsors" on public.sponsors;
create policy "admin manages sponsors" on public.sponsors for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin reads audit" on public.audit_logs;
create policy "admin reads audit" on public.audit_logs for select to authenticated using (public.is_admin());
drop policy if exists "admin writes audit" on public.audit_logs;
create policy "admin writes audit" on public.audit_logs for insert to authenticated with check (public.is_admin());

-- Para desarrollo: el primer usuario admin se promueve manualmente después de registrarlo.
-- update public.profiles set role = 'admin' where email = 'admin@jamb.com';

-- Electrolineras JAMB · datos semilla
-- Ejecutar después de schema.sql. Los usuarios se crean desde Auth > Users.

insert into public.stations (id, name, address, city, distance_km, status, price_per_kwh, rating, amenities, notes, active_vehicles, waiting_vehicles, avg_wait_min)
values
  ('00000000-0000-0000-0000-000000000001', 'JAMB Chapinero Norte', 'Cra. 13 #63-45, Bogotá', 'Bogotá', 1.2, 'disponible', 780, 4.7, array['Cafetería','Wifi','Techado'], 'Estación insignia de la red, cerca a la Zona G.', 2, 1, 12),
  ('00000000-0000-0000-0000-000000000002', 'JAMB Centro Comercial Sopó', 'Autopista Norte km 26, Sopó', 'Sopó', 3.8, 'ocupada', 720, 4.5, array['Baños','Restaurantes','Parqueadero'], 'Dentro del parqueadero del centro comercial, nivel -1.', 4, 2, 24),
  ('00000000-0000-0000-0000-000000000003', 'JAMB Terminal Salitre', 'Av. Boyacá #22-10, Bogotá', 'Bogotá', 5.6, 'disponible', 810, 4.8, array['Carga rápida','Seguridad 24/7'], 'Carga ultrarrápida, ideal antes de viajes largos.', 1, 0, 0),
  ('00000000-0000-0000-0000-000000000004', 'JAMB Parque La Colina', 'Cl. 145 #103-60, Bogotá', 'Bogotá', 7.1, 'mantenimiento', 760, 4.2, array['Zona verde','Parqueadero'], 'En mantenimiento programado.', 0, 0, 0)
on conflict (id) do update set name = excluded.name, status = excluded.status, price_per_kwh = excluded.price_per_kwh, rating = excluded.rating, amenities = excluded.amenities, updated_at = now();

insert into public.station_connectors (station_id, connector_type, power, available, total)
values
  ('00000000-0000-0000-0000-000000000001', 'Tipo 2 (AC)', '22 kW', 3, 4),
  ('00000000-0000-0000-0000-000000000001', 'CCS Combo (DC)', '60 kW', 1, 2),
  ('00000000-0000-0000-0000-000000000002', 'CHAdeMO (DC)', '50 kW', 0, 2),
  ('00000000-0000-0000-0000-000000000002', 'Tipo 2 (AC)', '11 kW', 2, 6),
  ('00000000-0000-0000-0000-000000000003', 'CCS Combo (DC)', '120 kW', 2, 3),
  ('00000000-0000-0000-0000-000000000004', 'Tipo 2 (AC)', '22 kW', 0, 4)
on conflict (station_id, connector_type) do update set power = excluded.power, available = excluded.available, total = excluded.total;

insert into public.sponsors (name, website_url)
values
  ('Andes Motors', 'https://example.com/andes-motors'),
  ('GridPoint Colombia', 'https://example.com/gridpoint'),
  ('Banco Solar', 'https://example.com/banco-solar'),
  ('Movilidad Andina', 'https://example.com/movilidad-andina'),
  ('Rueda Verde Seguros', 'https://example.com/rueda-verde'),
  ('Voltia Energía', 'https://example.com/voltia')
on conflict do nothing;

-- Después de crear admin@jamb.com en Supabase Auth, ejecutar:
-- update public.profiles set role = 'admin', plan = 'Operador de red' where email = 'admin@jamb.com';
