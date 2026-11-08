-- Mi bus · Unicórdoba — esquema inicial.
-- Ver docs/ADR-001-backend.md (decisión) y docs/DATA_MODEL.md (modelo de rutas).
--
-- Bloques:
--   1. Catálogo de rutas (lectura pública): stops, routes, route_patterns, pattern_stops,
--      service_headways, dataset_meta, buses.
--   2. Datos de viajeros (anónimos, privados): profiles, shared_trips, trip_positions,
--      occupancy_reports.
--   3. Funciones: get_transit_dataset, route_live_status, delete_my_data, purge_expired_data.
--   4. Retención de 30 días con pg_cron.
--
-- Privacidad (Ley 1581 de 2012): no se guardan nombres, correos ni teléfonos. Cada viajero es
-- un usuario anónimo de Supabase Auth (id aleatorio por instalación). Nadie puede leer las
-- posiciones ni los reportes de otro viajero: solo datos agregados por ruta.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------------------------

/** true si la geometría cae completa dentro de Montería y alrededores (igual que validate.ts). */
create or replace function public.in_monteria(g extensions.geography)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select extensions.st_xmin(g::extensions.geometry) >= -76.0
     and extensions.st_xmax(g::extensions.geometry) <= -75.7
     and extensions.st_ymin(g::extensions.geometry) >= 8.6
     and extensions.st_ymax(g::extensions.geometry) <= 8.95;
$$;

create type public.data_quality as enum ('ficticio', 'aproximado', 'verificado');
create type public.day_type as enum ('weekday', 'saturday', 'sunday_holiday');
create type public.occupancy_level as enum ('full', 'medium', 'empty');
create type public.trip_end_reason as enum ('user', 'auto_alighted', 'timeout');

-- ---------------------------------------------------------------------------------------------
-- 1. Catálogo de rutas
-- ---------------------------------------------------------------------------------------------

create table public.dataset_meta (
  id boolean primary key default true check (id), -- una sola fila
  schema_version smallint not null default 1,
  kind text not null check (kind in ('seed', 'import')),
  description text not null,
  generated_at timestamptz not null,
  loaded_at timestamptz not null default now()
);

create table public.stops (
  id text primary key,
  name text not null check (btrim(name) <> ''),
  location extensions.geography(point, 4326) not null check (public.in_monteria(location))
);

create table public.routes (
  id text primary key,
  short_name text not null check (btrim(short_name) <> ''),
  long_name text not null check (btrim(long_name) <> ''),
  operator text not null default '',
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0
);

create table public.route_patterns (
  id text primary key,
  route_id text not null references public.routes (id) on delete cascade,
  direction smallint not null check (direction in (0, 1)),
  headsign text not null check (btrim(headsign) <> ''),
  quality public.data_quality not null,
  shape extensions.geography(linestring, 4326) not null check (public.in_monteria(shape)),
  unique (route_id, direction)
);

create table public.pattern_stops (
  pattern_id text not null references public.route_patterns (id) on delete cascade,
  sequence integer not null check (sequence > 0),
  stop_id text not null references public.stops (id),
  minutes_from_start numeric(6, 2) not null check (minutes_from_start >= 0),
  primary key (pattern_id, sequence)
);

create table public.service_headways (
  route_id text not null references public.routes (id) on delete cascade,
  days public.day_type not null,
  quality public.data_quality not null,
  start_time time not null,
  end_time time not null,
  every_minutes integer not null check (every_minutes > 0),
  primary key (route_id, days, start_time),
  check (start_time < end_time)
);

/** Busetas físicas. El QR (etapa 3.2) identifica una fila de esta tabla. Sin placa ni conductor. */
create table public.buses (
  id uuid primary key default gen_random_uuid(),
  route_id text not null references public.routes (id),
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index pattern_stops_stop_idx on public.pattern_stops (stop_id);
create index stops_location_idx on public.stops using gist (location);
create index buses_route_idx on public.buses (route_id);

-- ---------------------------------------------------------------------------------------------
-- 2. Datos de viajeros (anónimos)
-- ---------------------------------------------------------------------------------------------

/** Perfil mínimo por usuario anónimo. Aquí irá el consentimiento (etapa 6.1). */
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  location_consent_at timestamptz,
  model_consent_at timestamptz
);

/** Un viaje compartido: desde "Compartir" hasta "Dejar de compartir" o bajar del bus. */
create table public.shared_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  route_id text not null references public.routes (id),
  bus_id uuid references public.buses (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason public.trip_end_reason,
  check ((ended_at is null) = (ended_reason is null)),
  check (ended_at is null or ended_at >= started_at)
);

-- Un solo viaje activo por usuario.
create unique index shared_trips_one_active_idx on public.shared_trips (user_id) where ended_at is null;
create index shared_trips_route_active_idx on public.shared_trips (route_id) where ended_at is null;
create index shared_trips_started_idx on public.shared_trips (started_at);

create table public.trip_positions (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.shared_trips (id) on delete cascade,
  recorded_at timestamptz not null,
  location extensions.geography(point, 4326) not null check (public.in_monteria(location)),
  speed_mps real check (speed_mps is null or speed_mps between 0 and 60),
  accuracy_m real check (accuracy_m is null or accuracy_m >= 0),
  created_at timestamptz not null default now()
);

create index trip_positions_trip_time_idx on public.trip_positions (trip_id, recorded_at desc);

create table public.occupancy_reports (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.shared_trips (id) on delete cascade,
  route_id text not null references public.routes (id),
  level public.occupancy_level not null,
  reported_at timestamptz not null default now()
);

create index occupancy_reports_route_time_idx on public.occupancy_reports (route_id, reported_at desc);
create index occupancy_reports_trip_idx on public.occupancy_reports (trip_id);

-- Perfil automático al crear un usuario (anónimo o no).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Límites antiabuso básicos (la etapa 6.2 los amplía).
create or replace function public.check_trip_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Primero la pertenencia: así un tercero no puede sondear los límites del viaje de otro.
  -- (auth.uid() es null para el rol de servicio y las tareas internas.)
  if auth.uid() is not null and not exists (
    select 1 from public.shared_trips t
    where t.id = new.trip_id and t.user_id = auth.uid() and t.ended_at is null
  ) then
    raise exception 'el viaje no existe, no es tuyo o ya terminó' using errcode = 'insufficient_privilege';
  end if;
  if new.recorded_at > now() + interval '1 minute' or new.recorded_at < now() - interval '10 minutes' then
    raise exception 'recorded_at fuera de rango' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.trip_positions p
    where p.trip_id = new.trip_id and p.created_at > now() - interval '3 seconds'
  ) then
    raise exception 'demasiadas posiciones: máximo una cada 3 segundos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trip_positions_limits
  before insert on public.trip_positions
  for each row execute function public.check_trip_position();

create or replace function public.check_occupancy_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_route text;
begin
  -- Primero la pertenencia: así un tercero no puede sondear los límites del viaje de otro.
  -- (auth.uid() es null para el rol de servicio y las tareas internas.)
  if auth.uid() is not null and not exists (
    select 1 from public.shared_trips t
    where t.id = new.trip_id and t.user_id = auth.uid() and t.ended_at is null
  ) then
    raise exception 'el viaje no existe, no es tuyo o ya terminó' using errcode = 'insufficient_privilege';
  end if;
  select t.route_id into trip_route from public.shared_trips t where t.id = new.trip_id;
  if trip_route is distinct from new.route_id then
    raise exception 'la ruta del reporte no coincide con la del viaje' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.occupancy_reports r
    where r.trip_id = new.trip_id and r.reported_at > now() - interval '2 minutes'
  ) then
    raise exception 'máximo un reporte de cupo cada 2 minutos por viaje' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.occupancy_reports r where r.trip_id = new.trip_id) >= 10 then
    raise exception 'máximo 10 reportes de cupo por viaje' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger occupancy_reports_limits
  before insert on public.occupancy_reports
  for each row execute function public.check_occupancy_report();

-- ---------------------------------------------------------------------------------------------
-- Seguridad por filas (RLS)
-- ---------------------------------------------------------------------------------------------

alter table public.dataset_meta enable row level security;
alter table public.stops enable row level security;
alter table public.routes enable row level security;
alter table public.route_patterns enable row level security;
alter table public.pattern_stops enable row level security;
alter table public.service_headways enable row level security;
alter table public.buses enable row level security;
alter table public.profiles enable row level security;
alter table public.shared_trips enable row level security;
alter table public.trip_positions enable row level security;
alter table public.occupancy_reports enable row level security;

-- Catálogo: cualquiera lee; solo el rol de servicio (importación) escribe.
create policy "catálogo público" on public.dataset_meta for select to anon, authenticated using (true);
create policy "catálogo público" on public.stops for select to anon, authenticated using (true);
create policy "catálogo público" on public.routes for select to anon, authenticated using (true);
create policy "catálogo público" on public.route_patterns for select to anon, authenticated using (true);
create policy "catálogo público" on public.pattern_stops for select to anon, authenticated using (true);
create policy "catálogo público" on public.service_headways for select to anon, authenticated using (true);
create policy "busetas activas" on public.buses for select to anon, authenticated using (active);

-- Perfil: solo el propio.
create policy "ver perfil propio" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "editar perfil propio" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Viajes: el viajero crea, ve y termina los suyos.
create policy "crear viaje propio" on public.shared_trips for insert to authenticated
  with check (user_id = (select auth.uid()) and ended_at is null);
create policy "ver viajes propios" on public.shared_trips for select to authenticated
  using (user_id = (select auth.uid()));
create policy "terminar viaje propio" on public.shared_trips for update to authenticated
  using (user_id = (select auth.uid()) and ended_at is null)
  with check (user_id = (select auth.uid()));

-- Posiciones y reportes: solo se escriben en un viaje propio y activo. Nadie los lee
-- directamente (ni siquiera su autor); se consultan agregados con route_live_status().
create policy "posición en viaje propio activo" on public.trip_positions for insert to authenticated
  with check (exists (
    select 1 from public.shared_trips t
    where t.id = trip_id and t.user_id = (select auth.uid()) and t.ended_at is null
  ));
create policy "reporte en viaje propio activo" on public.occupancy_reports for insert to authenticated
  with check (exists (
    select 1 from public.shared_trips t
    where t.id = trip_id and t.user_id = (select auth.uid()) and t.ended_at is null
  ));

-- Permisos de columnas: un viaje solo se puede actualizar para terminarlo.
revoke update on public.shared_trips from anon, authenticated;
grant update (ended_at, ended_reason) on public.shared_trips to authenticated;
revoke update, delete, truncate on public.trip_positions, public.occupancy_reports from anon, authenticated;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (location_consent_at, model_consent_at) on public.profiles to authenticated;
revoke all on public.shared_trips, public.trip_positions, public.occupancy_reports, public.profiles from anon;

-- ---------------------------------------------------------------------------------------------
-- 3. Funciones
-- ---------------------------------------------------------------------------------------------

/**
 * Catálogo completo en el formato TransitDataset de la app (src/data/model.ts).
 * La app lo descarga, lo valida con parseDataset() y lo guarda para usarlo sin conexión.
 */
create or replace function public.get_transit_dataset()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', coalesce((select m.schema_version from public.dataset_meta m), 1),
    'source', (
      select jsonb_build_object(
        'kind', m.kind,
        'description', m.description,
        'generatedAt', to_char(m.generated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      from public.dataset_meta m
    ),
    'stops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'coordinate', jsonb_build_object(
          'latitude', extensions.st_y(s.location::extensions.geometry),
          'longitude', extensions.st_x(s.location::extensions.geometry)
        )
      ) order by s.id)
      from public.stops s
    ), '[]'::jsonb),
    'routes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'shortName', r.short_name,
        'longName', r.long_name,
        'operator', r.operator,
        'color', r.color,
        'patterns', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', p.id,
            'direction', p.direction,
            'headsign', p.headsign,
            'quality', p.quality,
            'stops', coalesce((
              select jsonb_agg(jsonb_build_object(
                'stopId', ps.stop_id,
                'minutesFromStart', ps.minutes_from_start::float8
              ) order by ps.sequence)
              from public.pattern_stops ps where ps.pattern_id = p.id
            ), '[]'::jsonb),
            'shape', (
              select jsonb_agg(jsonb_build_object(
                'latitude', extensions.st_y(d.geom),
                'longitude', extensions.st_x(d.geom)
              ) order by d.path)
              from extensions.st_dumppoints(p.shape::extensions.geometry) d
            )
          ) order by p.direction)
          from public.route_patterns p where p.route_id = r.id
        ), '[]'::jsonb),
        'service', coalesce((
          select jsonb_agg(jsonb_build_object(
            'days', sd.days,
            'quality', sd.quality,
            'headways', sd.headways
          ) order by sd.days)
          from (
            select h.days, min(h.quality::text) as quality,
              jsonb_agg(jsonb_build_object(
                'from', to_char(h.start_time, 'HH24:MI'),
                'to', case when h.end_time = '24:00'::time then '24:00' else to_char(h.end_time, 'HH24:MI') end,
                'everyMinutes', h.every_minutes
              ) order by h.start_time) as headways
            from public.service_headways h where h.route_id = r.id
            group by h.days
          ) sd
        ), '[]'::jsonb)
      ) order by r.sort_order, r.id)
      from public.routes r
    ), '[]'::jsonb)
  );
$$;

/**
 * Estado en vivo agregado de una ruta (etapas 3.1 y 3.3). No devuelve viajes individuales:
 * la posición es el centro de las últimas posiciones (últimos 2 min) de los viajes activos,
 * redondeada a ~10 m, y el cupo es el nivel más reportado en los últimos 10 minutos.
 */
create or replace function public.route_live_status(p_route_id text)
returns table (
  active_trips integer,
  latitude double precision,
  longitude double precision,
  position_at timestamptz,
  occupancy public.occupancy_level,
  occupancy_reports integer,
  occupancy_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (p.trip_id) p.location, p.recorded_at
    from public.trip_positions p
    join public.shared_trips t on t.id = p.trip_id
    where t.route_id = p_route_id and t.ended_at is null
      and p.recorded_at > now() - interval '2 minutes'
    order by p.trip_id, p.recorded_at desc
  ),
  center as (
    select extensions.st_centroid(extensions.st_collect(l.location::extensions.geometry)) as g,
           max(l.recorded_at) as at
    from latest l
  ),
  reports as (
    select r.level, r.reported_at
    from public.occupancy_reports r
    where r.route_id = p_route_id and r.reported_at > now() - interval '10 minutes'
  )
  select
    (select count(*)::integer from public.shared_trips t where t.route_id = p_route_id and t.ended_at is null),
    round(extensions.st_y(c.g)::numeric, 4)::float8,
    round(extensions.st_x(c.g)::numeric, 4)::float8,
    c.at,
    (select mode() within group (order by r.level) from reports r),
    (select count(*)::integer from reports),
    (select max(r.reported_at) from reports r)
  from center c;
$$;

/** "Borrar mis datos": elimina el usuario anónimo y, en cascada, su perfil, viajes y reportes. */
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'se necesita una sesión' using errcode = 'insufficient_privilege';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

/** Retención: cierra viajes abandonados y borra lo que tenga más de 30 días. */
create or replace function public.purge_expired_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shared_trips
     set ended_at = now(), ended_reason = 'timeout'
   where ended_at is null and started_at < now() - interval '3 hours';

  delete from public.shared_trips where started_at < now() - interval '30 days';

  -- Usuarios anónimos sin actividad en 30 días (cascada: perfil).
  delete from auth.users u
   where u.is_anonymous
     and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
     and not exists (select 1 from public.shared_trips t where t.user_id = u.id);
end;
$$;

revoke execute on function public.purge_expired_data() from public, anon, authenticated;
revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_trip_position() from public, anon, authenticated;
revoke execute on function public.check_occupancy_report() from public, anon, authenticated;
grant execute on function public.get_transit_dataset() to anon, authenticated;
grant execute on function public.route_live_status(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Retención programada (todos los días a las 3:15 a. m. hora de Colombia = 08:15 UTC)
-- ---------------------------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('purge-expired-data', '15 8 * * *', $$ select public.purge_expired_data(); $$);
