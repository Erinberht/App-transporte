-- Pruebas del cupo del bus (etapa 3.3). Ejecutar con: npm run db:test (requiere npm run db:reset).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (id, aud, role, is_anonymous, created_at)
select ('00000000-0000-0000-0000-0000000000e' || n)::uuid, 'authenticated', 'authenticated', true, now()
from generate_series(1, 6) n;

-- Viajes: e1, e2 y e3 en la buseta PRUEBA-P3-01; e4 en la P3 sin QR; e5 en la T2.
insert into public.shared_trips (id, user_id, route_id, bus_id, started_at)
select ('40000000-0000-0000-0000-0000000000e' || n)::uuid,
       ('00000000-0000-0000-0000-0000000000e' || n)::uuid,
       case when n = 5 then 'T2' else 'P3' end,
       case when n <= 3 then (select id from public.buses where code = 'PRUEBA-P3-01') end,
       now() - interval '30 minutes'
from generate_series(1, 5) n;

-- Reportes fechados en el pasado (sin triggers).
set local session_replication_role = replica;
insert into public.occupancy_reports (trip_id, route_id, level, reported_at) values
  -- e1 primero dijo "vacío" y luego "lleno": solo cuenta "lleno".
  ('40000000-0000-0000-0000-0000000000e1', 'P3', 'empty', now() - interval '8 minutes'),
  ('40000000-0000-0000-0000-0000000000e1', 'P3', 'full', now() - interval '4 minutes'),
  ('40000000-0000-0000-0000-0000000000e2', 'P3', 'full', now() - interval '6 minutes'),
  ('40000000-0000-0000-0000-0000000000e3', 'P3', 'medium', now() - interval '1 minute'),
  -- De más de 10 minutos: no cuenta.
  ('40000000-0000-0000-0000-0000000000e5', 'T2', 'full', now() - interval '25 minutes');
set local session_replication_role = origin;

set local role anon;
select results_eq(
  $$ select level::text, reports, reported_at from public.live_occupancy() where route_id = 'P3' and bus_id is null $$,
  $$ values ('full'::text, 3, now() - interval '1 minute') $$,
  'ruta: un voto por viajero (el último de cada uno); gana "lleno" 2 a 1');
select results_eq(
  $$ select level::text, reports from public.live_occupancy()
     where bus_id = (select id from public.buses where code = 'PRUEBA-P3-01') $$,
  $$ values ('full'::text, 3) $$,
  'buseta: los viajeros que escanearon su QR');
select is((select count(*)::int from public.live_occupancy() where route_id = 'T2'), 0,
  'los reportes de más de 10 minutos no cuentan');
select results_eq(
  $$ select occupancy::text, occupancy_reports from public.route_live_status('P3') $$,
  $$ values ('full'::text, 3) $$,
  'route_live_status usa la misma regla');
select throws_ok($$ select count(*) from public.occupancy_reports $$, '42501', null,
  'nadie lee los reportes individuales');

-- Empate 1 a 1 en la T2: gana el más reciente.
reset role;
insert into public.shared_trips (id, user_id, route_id, started_at)
values ('40000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e6', 'T2', now() - interval '20 minutes');
set local session_replication_role = replica;
insert into public.occupancy_reports (trip_id, route_id, level, reported_at) values
  ('40000000-0000-0000-0000-0000000000e5', 'T2', 'full', now() - interval '5 minutes'),
  ('40000000-0000-0000-0000-0000000000f1', 'T2', 'empty', now() - interval '3 minutes');
set local session_replication_role = origin;
set local role anon;
select results_eq(
  $$ select level::text, reports from public.live_occupancy() where route_id = 'T2' and bus_id is null $$,
  $$ values ('empty'::text, 2) $$,
  'en empate gana el reporte más reciente');

-- Límites por viaje (de la migración inicial).
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select throws_ok(
  $$ insert into public.occupancy_reports (trip_id, route_id, level) values ('40000000-0000-0000-0000-0000000000e3', 'P3', 'full') $$,
  '23514', null, 'máximo un reporte cada 2 minutos por viaje');
select throws_ok(
  $$ insert into public.occupancy_reports (trip_id, route_id, level) values ('40000000-0000-0000-0000-0000000000e1', 'P3', 'full') $$,
  '42501', null, 'no se reporta en el viaje de otro');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}';
select lives_ok(
  $$ insert into public.occupancy_reports (trip_id, route_id, level) values ('40000000-0000-0000-0000-0000000000e4', 'P3', 'empty') $$,
  'un viajero reporta en su viaje activo');

select * from finish();
rollback;
