-- Pruebas de incidentes reportados por los viajeros (etapa 3.4).
-- Ejecutar con: npm run db:test (requiere npm run db:reset).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

insert into auth.users (id, aud, role, is_anonymous, created_at)
select ('00000000-0000-0000-0000-0000000000a' || n)::uuid, 'authenticated', 'authenticated', true, now()
from generate_series(1, 3) n;

-- a1 y a2 van en la P3 (a1 en la buseta PRUEBA-P3-01); a3 en la T2.
insert into public.shared_trips (id, user_id, route_id, bus_id)
values
  ('50000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'P3',
   (select id from public.buses where code = 'PRUEBA-P3-01')),
  ('50000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 'P3', null),
  ('50000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a3', 'T2', null);

-- Posiciones recientes de a1 y a2 junto a una parada del seed (Calle 22 con Carrera 6).
insert into public.trip_positions (trip_id, recorded_at, location)
select t, now(), (select location from public.stops where id = 'calle22-cra6')
from unnest(array['50000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-0000000000a2']::uuid[]) t;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ insert into public.incident_reports (trip_id, route_id, kind) values ('50000000-0000-0000-0000-0000000000a1', 'P3', 'broken_down') $$,
  'quien va en el bus reporta que se varó');
select throws_ok(
  $$ insert into public.incident_reports (trip_id, route_id, kind) values ('50000000-0000-0000-0000-0000000000a1', 'P3', 'broken_down') $$,
  '23514', null, 'cada tipo una sola vez por viaje');
select lives_ok(
  $$ insert into public.incident_reports (trip_id, route_id, kind) values ('50000000-0000-0000-0000-0000000000a1', 'P3', 'big_delay') $$,
  'otro tipo sí');
select lives_ok(
  $$ insert into public.incident_reports (trip_id, route_id, kind) values ('50000000-0000-0000-0000-0000000000a1', 'P3', 'detour') $$,
  'tercer tipo');
select throws_ok(
  $$ insert into public.incident_reports (trip_id, route_id, kind) values ('50000000-0000-0000-0000-0000000000a3', 'T2', 'detour') $$,
  '42501', null, 'no se reporta en el viaje de otro');
select throws_ok(
  $$ insert into public.incident_reports (trip_id, route_id, kind, location)
     values ('50000000-0000-0000-0000-0000000000a1', 'P3', 'detour', 'SRID=4326;POINT(-75.88 8.75)') $$,
  '42501', null, 'la app no puede elegir el lugar del incidente');
select throws_ok($$ select count(*) from public.incident_reports $$, '42501', null,
  'nadie lee los reportes individuales');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ insert into public.incident_reports (trip_id, route_id, kind) values ('50000000-0000-0000-0000-0000000000a2', 'P3', 'broken_down') $$,
  'un segundo viajero confirma');
select throws_ok(
  $$ insert into public.incident_reports (trip_id, route_id, kind) values ('50000000-0000-0000-0000-0000000000a2', 'T2', 'detour') $$,
  '23514', null, 'el reporte debe ser de la ruta del viaje');

reset role;
select is(
  (select bus_id from public.incident_reports where trip_id = '50000000-0000-0000-0000-0000000000a1' limit 1),
  (select id from public.buses where code = 'PRUEBA-P3-01'),
  'el bus lo pone el servidor desde el viaje');

set local role anon;
select results_eq(
  $$ select kind::text, reports, near_stop from public.live_incidents() where route_id = 'P3' and kind = 'broken_down' $$,
  $$ values ('broken_down'::text, 2, (select name from public.stops where id = 'calle22-cra6')) $$,
  'agrupa por ruta y tipo, cuenta viajeros y dice la parada más cercana');

-- A los 30 minutos el aviso desaparece.
reset role;
update public.incident_reports set reported_at = now() - interval '31 minutes';
set local role anon;
select is((select count(*)::int from public.live_incidents()), 0, 'los avisos duran 30 minutos');
select throws_ok($$ select public.check_incident_report() $$, '42501', null, 'el trigger no se llama directamente');

select * from finish();
rollback;
