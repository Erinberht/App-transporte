-- Pruebas del QR del bus (etapa 3.2): vincular un viaje a una buseta.
-- Ejecutar con: npm run db:test (requiere npm run db:reset).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

select is((select count(*)::int from public.buses where code like 'PRUEBA-%' and active), 20,
  'el seed trae 2 busetas de prueba por ruta');

-- Una buseta inactiva para las pruebas.
insert into public.buses (code, route_id, active) values ('PRUEBA-P3-99', 'P3', false);

insert into auth.users (id, aud, role, is_anonymous, created_at)
values ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', true, now());

set local role anon;
select is((select route_id from public.buses where code = 'PRUEBA-P3-01'), 'P3',
  'sin sesión se puede consultar a qué ruta pertenece un bus');
select is((select count(*)::int from public.buses where code = 'PRUEBA-P3-99'), 0,
  'las busetas inactivas no se ven');
select throws_ok($$ select public.check_trip_bus() $$, '42501', null, 'el trigger no se llama directamente');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select throws_ok(
  $$ insert into public.shared_trips (route_id, bus_id)
     values ('T2', (select id from public.buses where code = 'PRUEBA-P3-01')) $$,
  '23514', null, 'no se vincula un bus de otra ruta');
select throws_ok(
  $$ insert into public.shared_trips (route_id, bus_id) values ('P3', gen_random_uuid()) $$,
  '23514', null, 'no se vincula un bus inexistente');
select lives_ok(
  $$ insert into public.shared_trips (route_id, bus_id)
     values ('P3', (select id from public.buses where code = 'PRUEBA-P3-01')) $$,
  'se vincula un bus activo de la misma ruta');
select throws_ok(
  $$ update public.shared_trips set bus_id = null $$,
  '42501', null, 'el bus no se cambia después de crear el viaje');

select * from finish();
rollback;
