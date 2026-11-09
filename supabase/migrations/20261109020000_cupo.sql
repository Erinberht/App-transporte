-- Etapa 3.3 · Cupo del bus.
--
-- live_occupancy(): cupo de los últimos 10 minutos, por ruta (bus_id null) y por buseta (si
-- los viajeros escanearon su QR). Regla:
--   - Un viajero = un voto: de cada viaje cuenta solo su último reporte (si cambió de "medio"
--     a "lleno", vale "lleno").
--   - Gana el nivel con más votos; en empate, el reportado más recientemente.
-- Los límites por viaje (uno cada 2 minutos, máximo 10) ya están en check_occupancy_report.
-- Privacidad: solo se devuelven conteos y la hora del último reporte, nunca quién reportó.

create or replace function public.live_occupancy()
returns table (
  route_id text,
  bus_id uuid,
  level public.occupancy_level,
  reports integer,
  reported_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (r.trip_id) r.trip_id, r.route_id, t.bus_id, r.level, r.reported_at
    from public.occupancy_reports r
    join public.shared_trips t on t.id = r.trip_id
    where r.reported_at > now() - interval '10 minutes'
    order by r.trip_id, r.reported_at desc
  ),
  votes as (
    select l.route_id, null::uuid as bus_id, l.level, count(*) as n, max(l.reported_at) as at
    from latest l
    group by l.route_id, l.level
    union all
    select l.route_id, l.bus_id, l.level, count(*), max(l.reported_at)
    from latest l
    where l.bus_id is not null
    group by l.route_id, l.bus_id, l.level
  ),
  ranked as (
    select v.*,
           sum(v.n) over (partition by v.route_id, v.bus_id) as total,
           max(v.at) over (partition by v.route_id, v.bus_id) as last_at,
           row_number() over (partition by v.route_id, v.bus_id order by v.n desc, v.at desc) as rk
    from votes v
  )
  select r.route_id, r.bus_id, r.level, r.total::integer, r.last_at
  from ranked r
  where r.rk = 1;
$$;

-- route_live_status usa la misma regla para el cupo (antes: el nivel más repetido entre todos
-- los reportes, aunque fueran varios del mismo viajero).
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
  occ as (
    select o.level, o.reports, o.reported_at
    from public.live_occupancy() o
    where o.route_id = p_route_id and o.bus_id is null
  )
  select
    (select count(*)::integer from public.shared_trips t where t.route_id = p_route_id and t.ended_at is null),
    (select latitude from bus),
    (select longitude from bus),
    (select position_at from bus),
    (select level from occ),
    coalesce((select reports from occ), 0),
    (select reported_at from occ);
$$;

grant execute on function public.live_occupancy() to anon, authenticated;
grant execute on function public.route_live_status(text) to anon, authenticated;
