-- Etapa 3.1 · Compartir el recorrido en vivo.
--
--   1. live_bus_clusters(): agrupa a los viajeros de una ruta que están a menos de 300 m entre
--      sí; cada grupo es un bus. Así dos P3 en lados opuestos de la ciudad no se promedian en
--      un punto falso en medio de los dos.
--   2. route_live_buses(): un bus por grupo (para "Bus en el mapa").
--   3. route_live_status(): la posición pasa a ser la del grupo más grande (antes, el promedio
--      de todos los viajeros de la ruta).
--   4. close_stale_trips(): cierra los viajes que llevan 10 minutos sin enviar posiciones
--      (batería agotada, app cerrada a la fuerza...). pg_cron cada 5 minutos.
--
-- Privacidad: nunca se devuelve una posición individual identificable. Se publica el centro de
-- cada grupo redondeado a 4 decimales (~11 m) y cuántos viajeros lo forman. Con un solo
-- viajero, el centro es su posición (decisión del producto: es anónima, va dentro de un bus
-- público y la persona aceptó al pulsar "Compartir").

/** Grupos de viajeros (uno por bus) de una ruta. Privada: solo la usan las funciones de abajo. */
create or replace function public.live_bus_clusters(p_route_id text)
returns table (cluster_id integer, location extensions.geography, recorded_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    -- Última posición de cada viaje activo de la ruta, si es de los últimos 2 minutos.
    select distinct on (p.trip_id) p.location, p.recorded_at
    from public.trip_positions p
    join public.shared_trips t on t.id = p.trip_id
    where t.route_id = p_route_id and t.ended_at is null
      and p.recorded_at > now() - interval '2 minutes'
    order by p.trip_id, p.recorded_at desc
  )
  select
    -- EPSG:3857 está en metros (a la latitud de Montería el error es ~1 %).
    extensions.st_clusterdbscan(
      extensions.st_transform(l.location::extensions.geometry, 3857), eps => 300, minpoints => 1
    ) over () as cluster_id,
    l.location,
    l.recorded_at
  from latest l;
$$;

/** Buses en vivo de una ruta: uno por grupo de viajeros, el más concurrido primero. */
create or replace function public.route_live_buses(p_route_id text)
returns table (
  travelers integer,
  latitude double precision,
  longitude double precision,
  position_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with groups as (
    select count(*)::integer as travelers,
           extensions.st_centroid(extensions.st_collect(c.location::extensions.geometry)) as g,
           max(c.recorded_at) as at
    from public.live_bus_clusters(p_route_id) c
    group by c.cluster_id
  )
  select g.travelers,
         round(extensions.st_y(g.g)::numeric, 4)::float8,
         round(extensions.st_x(g.g)::numeric, 4)::float8,
         g.at
  from groups g
  order by g.travelers desc, g.at desc;
$$;

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
  with bus as (
    select b.latitude, b.longitude, b.position_at from public.route_live_buses(p_route_id) b limit 1
  ),
  reports as (
    select r.level, r.reported_at
    from public.occupancy_reports r
    where r.route_id = p_route_id and r.reported_at > now() - interval '10 minutes'
  )
  select
    (select count(*)::integer from public.shared_trips t where t.route_id = p_route_id and t.ended_at is null),
    (select latitude from bus),
    (select longitude from bus),
    (select position_at from bus),
    (select mode() within group (order by r.level) from reports r),
    (select count(*)::integer from reports),
    (select max(r.reported_at) from reports r);
$$;

/** Cierra los viajes sin posiciones en 10 minutos (o que nunca enviaron una en 10 minutos). */
create or replace function public.close_stale_trips()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed integer;
begin
  with stale as (
    select t.id, greatest(t.started_at, coalesce(max(p.recorded_at), t.started_at)) as last_seen
    from public.shared_trips t
    left join public.trip_positions p on p.trip_id = t.id
    where t.ended_at is null and t.started_at < now() - interval '10 minutes'
    group by t.id
    having coalesce(max(p.recorded_at), t.started_at) < now() - interval '10 minutes'
  )
  update public.shared_trips t
     set ended_at = s.last_seen, ended_reason = 'timeout'
    from stale s
   where t.id = s.id;
  get diagnostics closed = row_count;
  return closed;
end;
$$;

revoke execute on function public.live_bus_clusters(text) from public, anon, authenticated;
revoke execute on function public.close_stale_trips() from public, anon, authenticated;
grant execute on function public.route_live_buses(text) to anon, authenticated;
grant execute on function public.route_live_status(text) to anon, authenticated;

select cron.schedule('close-stale-trips', '*/5 * * * *', $$ select public.close_stale_trips(); $$);
