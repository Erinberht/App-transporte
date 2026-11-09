-- Etapa 3.2 · QR del bus.
--
-- El viaje compartido puede vincularse a una buseta (shared_trips.bus_id) al crearlo, después
-- de escanear el QR. Este trigger evita que alguien vincule su viaje a un bus inexistente,
-- inactivo o de otra ruta. (bus_id no se puede cambiar después: solo ended_at y ended_reason
-- tienen permiso de actualización.)

create or replace function public.check_trip_bus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.bus_id is not null and not exists (
    select 1 from public.buses b
    where b.id = new.bus_id and b.active and b.route_id = new.route_id
  ) then
    raise exception 'el bus no existe, no está activo o es de otra ruta' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger shared_trips_bus
  before insert on public.shared_trips
  for each row execute function public.check_trip_bus();

revoke execute on function public.check_trip_bus() from public, anon, authenticated;
