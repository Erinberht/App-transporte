-- Pruebas de "Compartir el recorrido en vivo" (etapa 3.1): buses agrupados y viajes abandonados.
-- Ejecutar con: npm run db:test (requiere npm run db:reset).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

insert into auth.users (id, aud, role, is_anonymous, created_at)
values
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', true, now()),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', true, now()),
  ('00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated', true, now()),
  ('00000000-0000-0000-0000-0000000000c4', 'authenticated', 'authenticated', true, now()),
  ('00000000-0000-0000-0000-0000000000c5', 'authenticated', 'authenticated', true, now());

-- Tres viajeros en la P3: dos en el mismo bus (a ~50 m) y uno en otro bus a ~3 km.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
insert into public.shared_trips (id, route_id) values ('30000000-0000-0000-0000-0000000000c1', 'P3');
insert into public.trip_positions (trip_id, recorded_at, location)
values ('30000000-0000-0000-0000-0000000000c1', now(), 'SRID=4326;POINT(-75.8800 8.7500)');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
insert into public.shared_trips (id, route_id) values ('30000000-0000-0000-0000-0000000000c2', 'P3');
insert into public.trip_positions (trip_id, recorded_at, location)
values ('30000000-0000-0000-0000-0000000000c2', now(), 'SRID=4326;POINT(-75.8800 8.7504)');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
insert into public.shared_trips (id, route_id) values ('30000000-0000-0000-0000-0000000000c3', 'P3');
insert into public.trip_positions (trip_id, recorded_at, location)
values ('30000000-0000-0000-0000-0000000000c3', now(), 'SRID=4326;POINT(-75.8700 8.7750)');

-- ------------------------------------------------------------------ buses agrupados
reset role;
set local role anon;
select is((select count(*)::int from public.route_live_buses('P3')), 2,
  'dos buses de la misma ruta se ven separados');
select results_eq(
  $$ select travelers, latitude, longitude from public.route_live_buses('P3') $$,
  $$ values (2, 8.7502::float8, -75.88::float8), (1, 8.775::float8, -75.87::float8) $$,
  'cada bus es el centro de su grupo; el más concurrido primero');
select results_eq(
  $$ select active_trips, latitude, longitude from public.route_live_status('P3') $$,
  $$ values (3, 8.7502::float8, -75.88::float8) $$,
  'route_live_status usa el bus más concurrido, no el promedio de toda la ruta');
select is((select count(*)::int from public.route_live_buses('T2')), 0, 'sin viajeros no hay buses');
select throws_ok($$ select * from public.live_bus_clusters('P3') $$, '42501', null,
  'anon no accede a los grupos crudos');
select throws_ok($$ select public.close_stale_trips() $$, '42501', null,
  'anon no cierra viajes');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select throws_ok($$ select public.close_stale_trips() $$, '42501', null,
  'un viajero tampoco cierra viajes');

-- ------------------------------------------------------------------ viajes abandonados
reset role;
-- c4: última posición hace 20 min. c5: empezó hace 15 min y nunca envió nada.
insert into public.shared_trips (id, user_id, route_id, started_at)
values
  ('30000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c4', 'T2', now() - interval '40 minutes'),
  ('30000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000c5', 'T2', now() - interval '15 minutes');
-- Sin triggers: la posición vieja no pasaría el límite de 10 minutos.
set local session_replication_role = replica;
insert into public.trip_positions (trip_id, recorded_at, location)
values ('30000000-0000-0000-0000-0000000000c4', now() - interval '20 minutes', 'SRID=4326;POINT(-75.8800 8.7500)');
set local session_replication_role = origin;

select is(public.close_stale_trips(), 2, 'cierra los dos viajes abandonados');
select results_eq(
  $$ select ended_reason::text, ended_at from public.shared_trips where id = '30000000-0000-0000-0000-0000000000c4' $$,
  $$ values ('timeout'::text, now() - interval '20 minutes') $$,
  'el viaje termina en su última posición, por tiempo');
select is((select ended_at from public.shared_trips where id = '30000000-0000-0000-0000-0000000000c5'),
  now() - interval '15 minutes', 'sin posiciones, termina cuando empezó');
select is((select count(*)::int from public.shared_trips where route_id = 'P3' and ended_at is null), 3,
  'no toca los viajes que siguen enviando');

select isnt_empty($$ select 1 from cron.job where jobname = 'close-stale-trips' and schedule = '*/5 * * * *' $$,
  'pg_cron revisa cada 5 minutos');

select * from finish();
rollback;
