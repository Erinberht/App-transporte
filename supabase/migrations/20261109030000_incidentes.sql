-- Etapa 3.4 · Busetas varadas, desvíos y retrasos reportados por los viajeros.
--
-- Solo puede reportar quien está compartiendo un viaje activo en esa ruta (va en el bus).
-- La posición del incidente NO la manda la app: se toma de la última posición del propio
-- viaje (de los últimos 5 minutos), así no se puede reportar un incidente en otro lugar.
-- Límites por viaje: cada tipo una sola vez y máximo 3 reportes. Los avisos duran 30 minutos.
-- Privacidad: live_incidents() devuelve conteos y el centro de los reportes redondeado a
-- ~100 m (3 decimales) con la parada más cercana, nunca quién reportó.

create type public.incident_kind as enum ('broken_down', 'detour', 'big_delay');

create table public.incident_reports (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.shared_trips (id) on delete cascade,
  route_id text not null references public.routes (id),
  bus_id uuid references public.buses (id) on delete set null,
  kind public.incident_kind not null,
  location extensions.geography(point, 4326) check (location is null or public.in_monteria(location)),
  reported_at timestamptz not null default now()
);

create index incident_reports_time_idx on public.incident_reports (reported_at desc);
create index incident_reports_trip_idx on public.incident_reports (trip_id);

create or replace function public.check_incident_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip record;
begin
  -- Primero la pertenencia: así un tercero no puede sondear los límites del viaje de otro.
  select t.route_id, t.bus_id into trip
  from public.shared_trips t
  where t.id = new.trip_id and t.user_id = auth.uid() and t.ended_at is null;
  if not found then
    raise exception 'el viaje no existe, no es tuyo o ya terminó' using errcode = 'insufficient_privilege';
  end if;
  if trip.route_id is distinct from new.route_id then
    raise exception 'la ruta del reporte no coincide con la del viaje' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.incident_reports r where r.trip_id = new.trip_id and r.kind = new.kind
  ) then
    raise exception 'ya reportaste este incidente en este viaje' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.incident_reports r where r.trip_id = new.trip_id) >= 3 then
    raise exception 'máximo 3 reportes de incidentes por viaje' using errcode = 'check_violation';
  end if;

  -- Lo que la app no puede elegir: bus, lugar y hora.
  new.bus_id := trip.bus_id;
  new.location := (
    select p.location from public.trip_positions p
    where p.trip_id = new.trip_id and p.recorded_at > now() - interval '5 minutes'
    order by p.recorded_at desc
    limit 1
  );
  new.reported_at := now();
  return new;
end;
$$;

create trigger incident_reports_limits
  before insert on public.incident_reports
  for each row execute function public.check_incident_report();

alter table public.incident_reports enable row level security;

create policy "incidente en viaje propio activo" on public.incident_reports for insert to authenticated
  with check (exists (
    select 1 from public.shared_trips t
    where t.id = trip_id and t.user_id = (select auth.uid()) and t.ended_at is null
  ));

-- La app solo elige viaje, ruta y tipo. Nadie lee los reportes individuales.
revoke all on public.incident_reports from anon, authenticated;
grant insert (trip_id, route_id, kind) on public.incident_reports to authenticated;

/** Incidentes de los últimos 30 minutos, agrupados por ruta y tipo. */
create or replace function public.live_incidents()
returns table (
  route_id text,
  kind public.incident_kind,
  reports integer,
  reported_at timestamptz,
  latitude double precision,
  longitude double precision,
  near_stop text
)
language sql
stable
security definer
set search_path = ''
as $$
  with recent as (
    select r.route_id, r.kind, r.trip_id, r.location, r.reported_at
    from public.incident_reports r
    where r.reported_at > now() - interval '30 minutes'
  ),
  grouped as (
    select g.route_id, g.kind,
           count(distinct g.trip_id)::integer as reports,
           max(g.reported_at) as reported_at,
           extensions.st_centroid(extensions.st_collect(g.location::extensions.geometry)) as center
    from recent g
    group by g.route_id, g.kind
  )
  select g.route_id, g.kind, g.reports, g.reported_at,
         round(extensions.st_y(g.center)::numeric, 3)::float8,
         round(extensions.st_x(g.center)::numeric, 3)::float8,
         (select s.name from public.stops s
          where g.center is not null
            and extensions.st_dwithin(s.location, g.center::extensions.geography, 500)
          order by extensions.st_distance(s.location, g.center::extensions.geography)
          limit 1)
  from grouped g
  order by g.reported_at desc;
$$;

revoke execute on function public.check_incident_report() from public, anon, authenticated;
grant execute on function public.live_incidents() to anon, authenticated;
