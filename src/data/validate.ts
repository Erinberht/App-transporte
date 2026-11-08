// Validación del conjunto de datos de rutas. La usan la app (al cargar el JSON), los tests y el
// script de importación. Solo importa tipos para que Node pueda ejecutarlo sin compilar.
import type { DayType, LatLng, TransitDataset } from './model';

/** Área que cubre Montería y sus alrededores (incluye el aeropuerto y la vía a Cereté). */
export const MONTERIA_BOUNDS = {
  minLatitude: 8.6,
  maxLatitude: 8.95,
  minLongitude: -76.0,
  maxLongitude: -75.7,
};

const DAY_TYPES: readonly DayType[] = ['weekday', 'saturday', 'sunday_holiday'];
const QUALITIES = ['ficticio', 'aproximado', 'verificado'];
const HHMM = /^([01]\d|2[0-4]):([0-5]\d)$/;

/** Convierte "HH:MM" en minutos desde medianoche, o null si el formato no es válido. */
export function parseHHMM(value: string): number | null {
  const match = HHMM.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 24 * 60 ? minutes : null;
}

export function isInMonteria({ latitude, longitude }: LatLng): boolean {
  const b = MONTERIA_BOUNDS;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= b.minLatitude &&
    latitude <= b.maxLatitude &&
    longitude >= b.minLongitude &&
    longitude <= b.maxLongitude
  );
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) (seen.has(id) ? repeated : seen).add(id);
  return [...repeated];
}

/** Devuelve la lista de errores del conjunto de datos (vacía si es válido). */
export function validateDataset(ds: TransitDataset): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  if (ds.schemaVersion !== 1) err(`schemaVersion desconocida: ${String(ds.schemaVersion)}`);
  if (ds.source?.kind !== 'seed' && ds.source?.kind !== 'import') err('source.kind inválido');
  if (!Array.isArray(ds.stops) || !Array.isArray(ds.routes)) {
    err('Faltan las listas stops o routes');
    return errors;
  }

  for (const id of duplicates(ds.stops.map((s) => s.id))) err(`Parada repetida: ${id}`);
  for (const id of duplicates(ds.routes.map((r) => r.id))) err(`Ruta repetida: ${id}`);

  const stopIds = new Set(ds.stops.map((s) => s.id));
  for (const stop of ds.stops) {
    if (!stop.name?.trim()) err(`Parada ${stop.id}: sin nombre`);
    if (!isInMonteria(stop.coordinate)) err(`Parada ${stop.id}: coordenada fuera de Montería`);
  }

  if (ds.routes.length === 0) err('No hay rutas');

  for (const route of ds.routes) {
    const where = `Ruta ${route.id}`;
    if (!route.shortName?.trim()) err(`${where}: sin código (shortName)`);
    if (!route.longName?.trim()) err(`${where}: sin nombre (longName)`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(route.color ?? '')) err(`${where}: color inválido`);
    if (!route.patterns?.length) err(`${where}: sin recorridos`);
    if (!route.service?.length) err(`${where}: sin horario`);

    for (const id of duplicates((route.patterns ?? []).map((p) => p.id))) {
      err(`${where}: recorrido repetido ${id}`);
    }

    for (const pattern of route.patterns ?? []) {
      const at = `${where} / ${pattern.id}`;
      if (pattern.direction !== 0 && pattern.direction !== 1)
        err(`${at}: direction debe ser 0 o 1`);
      if (!QUALITIES.includes(pattern.quality)) err(`${at}: quality inválida`);
      if (!pattern.headsign?.trim()) err(`${at}: sin letrero (headsign)`);
      if (pattern.stops.length < 2) err(`${at}: necesita al menos 2 paradas`);
      let previous = -Infinity;
      for (const ps of pattern.stops) {
        if (!stopIds.has(ps.stopId)) err(`${at}: parada desconocida ${ps.stopId}`);
        if (!Number.isFinite(ps.minutesFromStart) || ps.minutesFromStart < 0) {
          err(`${at}: minutos inválidos en ${ps.stopId}`);
        } else if (ps.minutesFromStart < previous) {
          err(`${at}: los minutos retroceden en ${ps.stopId}`);
        }
        previous = ps.minutesFromStart;
      }
      if (pattern.shape.length < 2) err(`${at}: el trazado necesita al menos 2 puntos`);
      if (pattern.shape.some((p) => !isInMonteria(p))) err(`${at}: trazado fuera de Montería`);
    }

    for (const period of route.service ?? []) {
      const at = `${where} / horario ${period.days}`;
      if (!DAY_TYPES.includes(period.days)) err(`${at}: tipo de día inválido`);
      if (!QUALITIES.includes(period.quality)) err(`${at}: quality inválida`);
      let previousEnd = -Infinity;
      for (const h of period.headways) {
        const from = parseHHMM(h.from);
        const to = parseHHMM(h.to);
        if (from === null || to === null) {
          err(`${at}: hora inválida ${h.from}-${h.to}`);
          continue;
        }
        if (from >= to) err(`${at}: la franja ${h.from}-${h.to} no avanza`);
        if (from < previousEnd) err(`${at}: franjas solapadas o desordenadas en ${h.from}`);
        if (!Number.isInteger(h.everyMinutes) || h.everyMinutes <= 0) {
          err(`${at}: frecuencia inválida en ${h.from}`);
        }
        previousEnd = to;
      }
    }
    for (const day of duplicates((route.service ?? []).map((s) => s.days))) {
      err(`${where}: horario repetido para ${day}`);
    }
  }

  return errors;
}

/** Valida un JSON desconocido y lo devuelve tipado, o lanza un error con todos los problemas. */
export function parseDataset(json: unknown): TransitDataset {
  const ds = json as TransitDataset;
  const errors = validateDataset(ds);
  if (errors.length > 0) {
    throw new Error(`Datos de rutas inválidos:\n- ${errors.join('\n- ')}`);
  }
  return ds;
}
