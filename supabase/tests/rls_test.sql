-- Pruebas de seguridad y privacidad del esquema (pgTAP). Ejecutar con: npm run db:test
-- Requiere la base local con el seed cargado (npm run db:reset).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(30);

-- Dos viajeros anónimos.
insert into auth.users (id, aud, role, is_anonymous, created_at)
values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', true, now()),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', true, now());

select is((select count(*)::int from public.profiles where id in (
  '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')), 2,
  'cada usuario nuevo recibe un perfil');

-- ------------------------------------------------------------------ anónimo (sin sesión)
set local role anon;
select is((select count(*)::int from public.routes), 10, 'anon lee las 10 rutas');
select ok(jsonb_array_length(public.get_transit_dataset() -> 'routes') = 10, 'anon descarga el catálogo');
select throws_ok($$ select count(*) from public.shared_trips $$, '42501', null, 'anon no tiene acceso a viajes');
select throws_ok(
  $$ insert into public.routes (id, short_name, long_name, color) values ('ZZ', 'ZZ', 'x', '#000000') $$,
  '42501', null, 'anon no modifica el catálogo');
select throws_ok(
  $$ insert into public.shared_trips (user_id, route_id) values ('00000000-0000-0000-0000-00000000000a', 'P1') $$,
  '42501', null, 'anon no crea viajes');
select throws_ok($$ select public.delete_my_data() $$, '42501', null, 'anon no puede borrar datos');
select throws_ok($$ select public.purge_expired_data() $$, '42501', null, 'anon no ejecuta la purga');

-- ------------------------------------------------------------------ viajero A
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","is_anonymous":true}';

select throws_ok(
  $$ insert into public.routes (id, short_name, long_name, color) values ('ZZ', 'ZZ', 'x', '#000000') $$,
  '42501', null, 'un viajero no modifica el catálogo');

insert into public.shared_trips (id, route_id) values ('10000000-0000-0000-0000-00000000000a', 'P1');
select is((select user_id from public.shared_trips where id = '10000000-0000-0000-0000-00000000000a'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'el viaje queda a nombre de quien lo crea');

select throws_ok(
  $$ insert into public.shared_trips (route_id) values ('T2') $$,
  '23505', null, 'solo un viaje activo por usuario');

select throws_ok(
  $$ insert into public.shared_trips (user_id, route_id) values ('00000000-0000-0000-0000-00000000000b', 'T2') $$,
  '42501', null, 'no se puede crear un viaje a nombre de otro');

select lives_ok(
  $$ insert into public.trip_positions (trip_id, recorded_at, location, speed_mps)
     values ('10000000-0000-0000-0000-00000000000a', now(), 'SRID=4326;POINT(-75.869 8.742)', 5) $$,
  'envía una posición en su viaje activo');
select throws_ok(
  $$ insert into public.trip_positions (trip_id, recorded_at, location)
     values ('10000000-0000-0000-0000-00000000000a', now(), 'SRID=4326;POINT(-75.869 8.743)') $$,
  '23514', null, 'máximo una posición cada 3 segundos');
select throws_ok(
  $$ insert into public.trip_positions (trip_id, recorded_at, location)
     values ('10000000-0000-0000-0000-00000000000a', now(), 'SRID=4326;POINT(-74.07 4.71)') $$,
  '23514', null, 'rechaza posiciones fuera de Montería');
select throws_ok(
  $$ insert into public.trip_positions (trip_id, recorded_at, location)
     values ('10000000-0000-0000-0000-00000000000a', now() - interval '1 hour', 'SRID=4326;POINT(-75.869 8.743)') $$,
  '23514', null, 'rechaza posiciones viejas');
select is((select count(*)::int from public.trip_positions), 0, 'ni siquiera el autor lee posiciones crudas');

select lives_ok(
  $$ insert into public.occupancy_reports (trip_id, route_id, level) values ('10000000-0000-0000-0000-00000000000a', 'P1', 'medium') $$,
  'reporta cupo');
select throws_ok(
  $$ insert into public.occupancy_reports (trip_id, route_id, level) values ('10000000-0000-0000-0000-00000000000a', 'P1', 'full') $$,
  '23514', null, 'máximo un reporte cada 2 minutos');
select throws_ok(
  $$ insert into public.occupancy_reports (trip_id, route_id, level) values ('10000000-0000-0000-0000-00000000000a', 'T2', 'full') $$,
  '23514', null, 'el reporte debe ser de la ruta del viaje');

select throws_ok(
  $$ update public.shared_trips set route_id = 'T2' where id = '10000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'no se puede cambiar la ruta de un viaje');

-- ------------------------------------------------------------------ viajero B no ve nada de A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.shared_trips), 0, 'B no ve los viajes de A');
select is((select count(*)::int from public.profiles), 1, 'B solo ve su perfil');
select throws_ok(
  $$ insert into public.trip_positions (trip_id, recorded_at, location)
     values ('10000000-0000-0000-0000-00000000000a', now(), 'SRID=4326;POINT(-75.869 8.742)') $$,
  '42501', null, 'B no puede enviar posiciones al viaje de A');

-- Estado agregado: visible para todos, sin datos individuales.
select results_eq(
  $$ select active_trips, latitude, longitude, occupancy::text, occupancy_reports from public.route_live_status('P1') $$,
  $$ values (1, 8.742::float8, -75.869::float8, 'medium'::text, 1) $$,
  'route_live_status agrega posición y cupo');

-- ------------------------------------------------------------------ A termina el viaje
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","is_anonymous":true}';
update public.shared_trips set ended_at = now(), ended_reason = 'user'
 where id = '10000000-0000-0000-0000-00000000000a';
select throws_ok(
  $$ insert into public.occupancy_reports (trip_id, route_id, level) values ('10000000-0000-0000-0000-00000000000a', 'P1', 'empty') $$,
  '42501', null, 'no se reporta en un viaje terminado');

-- "Borrar mis datos"
select lives_ok($$ select public.delete_my_data() $$, 'A borra sus datos');
reset role;
select is((select count(*)::int from public.shared_trips where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'se borran los viajes de A');
select is((select count(*)::int from public.occupancy_reports where trip_id = '10000000-0000-0000-0000-00000000000a'), 0,
  'y sus reportes (cascada)');

-- ------------------------------------------------------------------ retención de 30 días
insert into public.shared_trips (id, user_id, route_id, started_at)
values ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'T2', now() - interval '31 days');
select public.purge_expired_data();
select is((select count(*)::int from public.shared_trips where id = '20000000-0000-0000-0000-00000000000b'), 0,
  'la purga borra viajes de más de 30 días');

select * from finish();
rollback;
