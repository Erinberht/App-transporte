// Convierte un TransitDataset en SQL para cargar el catálogo de rutas en Supabase
// (tablas de supabase/migrations). Lo usa scripts/dataset-to-sql.ts para generar
// supabase/seed.sql. Sin importaciones de valores para que Node lo ejecute sin compilar.
import type { LatLng, TransitDataset } from './model';

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;
const num = (value: number) => {
  if (!Number.isFinite(value)) throw new Error(`Número inválido: ${value}`);
  return String(value);
};
const point = ({ latitude, longitude }: LatLng) =>
  `extensions.st_setsrid(extensions.st_makepoint(${num(longitude)}, ${num(latitude)}), 4326)::extensions.geography`;
const line = (points: LatLng[]) =>
  `extensions.st_geogfromtext(${q(
    `SRID=4326;LINESTRING(${points.map((p) => `${num(p.longitude)} ${num(p.latitude)}`).join(', ')})`,
  )})`;

function values(rows: string[][]): string {
  return rows.map((r) => `  (${r.join(', ')})`).join(',\n');
}

/**
 * SQL idempotente: actualiza rutas, paradas y recorridos existentes, reemplaza paradas de
 * recorridos y horarios, y borra recorridos que ya no están. No borra rutas ni paradas que
 * ya no estén (pueden tener viajes o busetas asociadas): lo avisa con un NOTICE.
 */
export function datasetToSql(ds: TransitDataset): string {
  const patterns = ds.routes.flatMap((r) => r.patterns.map((p) => ({ route: r, p })));
  const headways = ds.routes.flatMap((r) =>
    r.service.flatMap((s) => s.headways.map((h) => ({ route: r, s, h }))),
  );
  const routeIds = ds.routes.map((r) => q(r.id)).join(', ');
  const stopIds = ds.stops.map((s) => q(s.id)).join(', ');
  const patternIds = patterns.map(({ p }) => q(p.id)).join(', ');

  return `-- GENERADO por scripts/dataset-to-sql.ts desde src/data/dataset.json. No editar a mano.
-- Origen: ${ds.source.kind} · ${ds.source.description.replace(/\n/g, ' ')}

begin;

insert into public.dataset_meta (id, schema_version, kind, description, generated_at, loaded_at)
values (true, ${ds.schemaVersion}, ${q(ds.source.kind)}, ${q(ds.source.description)}, ${q(ds.source.generatedAt)}, now())
on conflict (id) do update set
  schema_version = excluded.schema_version, kind = excluded.kind,
  description = excluded.description, generated_at = excluded.generated_at, loaded_at = now();

insert into public.stops (id, name, location) values
${values(ds.stops.map((s) => [q(s.id), q(s.name), point(s.coordinate)]))}
on conflict (id) do update set name = excluded.name, location = excluded.location;

insert into public.routes (id, short_name, long_name, operator, color, sort_order) values
${values(
  ds.routes.map((r, i) => [
    q(r.id),
    q(r.shortName),
    q(r.longName),
    q(r.operator),
    q(r.color),
    String(i),
  ]),
)}
on conflict (id) do update set
  short_name = excluded.short_name, long_name = excluded.long_name, operator = excluded.operator,
  color = excluded.color, sort_order = excluded.sort_order;

delete from public.route_patterns where id not in (${patternIds});

insert into public.route_patterns (id, route_id, direction, headsign, quality, shape) values
${values(
  patterns.map(({ route, p }) => [
    q(p.id),
    q(route.id),
    String(p.direction),
    q(p.headsign),
    q(p.quality),
    line(p.shape),
  ]),
)}
on conflict (id) do update set
  route_id = excluded.route_id, direction = excluded.direction, headsign = excluded.headsign,
  quality = excluded.quality, shape = excluded.shape;

delete from public.pattern_stops where pattern_id in (${patternIds});
insert into public.pattern_stops (pattern_id, sequence, stop_id, minutes_from_start) values
${values(
  patterns.flatMap(({ p }) =>
    p.stops.map((s, i) => [q(p.id), String(i + 1), q(s.stopId), num(s.minutesFromStart)]),
  ),
)};

delete from public.service_headways where route_id in (${routeIds});
insert into public.service_headways (route_id, days, quality, start_time, end_time, every_minutes) values
${values(
  headways.map(({ route, s, h }) => [
    q(route.id),
    q(s.days),
    q(s.quality),
    q(h.from),
    q(h.to),
    String(h.everyMinutes),
  ]),
)};

do $$
declare
  extra text;
begin
  select string_agg(id, ', ') into extra from public.routes where id not in (${routeIds});
  if extra is not null then raise notice 'Rutas que ya no están en los datos (no se borran): %', extra; end if;
  select string_agg(id, ', ') into extra from public.stops where id not in (${stopIds});
  if extra is not null then raise notice 'Paradas que ya no están en los datos (no se borran): %', extra; end if;
end $$;

commit;
`;
}
