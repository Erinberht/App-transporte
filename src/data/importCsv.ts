// Convierte los CSV de rutas (formato en docs/DATA_MODEL.md) en un TransitDataset validado.
// Lo usa scripts/import-routes.ts; vive en src/ para poder probarlo con Jest.
// Las importaciones llevan extensión .ts para que Node lo ejecute sin compilar.
import { distanceMeters } from './geo.ts';
import type {
  BusRoute,
  DataQuality,
  DayType,
  LatLng,
  RoutePattern,
  ServicePeriod,
  Stop,
  TransitDataset,
} from './model';
import { validateDataset } from './validate.ts';

/** Velocidad comercial supuesta cuando el CSV no trae minutos entre paradas. */
export const DEFAULT_SPEED_KMH = 18;
/** Tiempo supuesto detenido en cada parada intermedia. */
export const DEFAULT_DWELL_MINUTES = 0.5;

export type CsvFiles = {
  'routes.csv': string;
  'stops.csv': string;
  'patterns.csv': string;
  'pattern_stops.csv': string;
  'service.csv': string;
  /** Opcional: si falta, el trazado une las paradas en línea recta. */
  'shapes.csv'?: string;
};

export const REQUIRED_FILES = [
  'routes.csv',
  'stops.csv',
  'patterns.csv',
  'pattern_stops.csv',
  'service.csv',
] as const;

type Row = Record<string, string>;

/** Lector de CSV con comillas dobles (RFC 4180). Primera fila = encabezados. */
export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const out: Row = {};
    headers.forEach((h, idx) => (out[h] = (cells[idx] ?? '').trim()));
    return out;
  });
}

class ImportError extends Error {}

function need(row: Row, column: string, file: string, line: number): string {
  const value = row[column];
  if (value === undefined || value === '') {
    throw new ImportError(`${file}, fila ${line}: falta "${column}"`);
  }
  return value;
}

function num(row: Row, column: string, file: string, line: number): number {
  const value = Number(need(row, column, file, line));
  if (!Number.isFinite(value))
    throw new ImportError(`${file}, fila ${line}: "${column}" no es un número`);
  return value;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

/** Minutos estimados recorriendo `path` a `speedKmh`, más la espera en paradas intermedias. */
function estimateMinutes(path: LatLng[], speedKmh: number): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) {
    const km = distanceMeters(path[i - 1], path[i]) / 1000;
    const dwell = i > 1 ? DEFAULT_DWELL_MINUTES : 0;
    out.push(out[i - 1] + (km / speedKmh) * 60 + dwell);
  }
  return out.map((m) => Math.round(m));
}

export type ImportOptions = {
  kind: TransitDataset['source']['kind'];
  description: string;
  generatedAt?: string;
  speedKmh?: number;
};

export type ImportResult =
  { ok: true; dataset: TransitDataset; warnings: string[] } | { ok: false; errors: string[] };

/** Construye y valida el conjunto de datos. Nunca lanza: devuelve los errores encontrados. */
export function importFromCsv(files: CsvFiles, options: ImportOptions): ImportResult {
  try {
    return build(files, options);
  } catch (e) {
    if (e instanceof ImportError) return { ok: false, errors: [e.message] };
    throw e;
  }
}

function build(files: CsvFiles, options: ImportOptions): ImportResult {
  const warnings: string[] = [];
  const speed = options.speedKmh ?? DEFAULT_SPEED_KMH;

  const stops: Stop[] = parseCsv(files['stops.csv']).map((r, i) => ({
    id: need(r, 'stop_id', 'stops.csv', i + 2),
    name: need(r, 'name', 'stops.csv', i + 2),
    coordinate: {
      latitude: num(r, 'lat', 'stops.csv', i + 2),
      longitude: num(r, 'lng', 'stops.csv', i + 2),
    },
  }));
  const stopById = new Map(stops.map((s) => [s.id, s]));

  const patternStopRows = groupBy(
    parseCsv(files['pattern_stops.csv']).map((r, i) => ({ r, line: i + 2 })),
    ({ r }) => r.pattern_id,
  );
  const shapeRows = groupBy(
    parseCsv(files['shapes.csv'] ?? '').map((r, i) => ({ r, line: i + 2 })),
    ({ r }) => r.pattern_id,
  );

  const patterns = parseCsv(files['patterns.csv']).map((r, i): [string, RoutePattern] => {
    const line = i + 2;
    const id = need(r, 'pattern_id', 'patterns.csv', line);
    const direction = num(r, 'direction', 'patterns.csv', line);

    const ordered = (patternStopRows.get(id) ?? [])
      .map(({ r: ps, line: l }) => ({
        seq: num(ps, 'sequence', 'pattern_stops.csv', l),
        stopId: need(ps, 'stop_id', 'pattern_stops.csv', l),
        minutes:
          ps.minutes_from_start === ''
            ? null
            : num(ps, 'minutes_from_start', 'pattern_stops.csv', l),
      }))
      .sort((a, b) => a.seq - b.seq);

    const stopPath = ordered
      .map((o) => stopById.get(o.stopId)?.coordinate)
      .filter((c): c is LatLng => c !== undefined);
    const estimated = estimateMinutes(stopPath, speed);
    if (ordered.some((o) => o.minutes === null)) {
      warnings.push(`${id}: minutos entre paradas estimados a ${speed} km/h`);
    }

    const shapePoints = (shapeRows.get(id) ?? [])
      .map(({ r: sp, line: l }) => ({
        seq: num(sp, 'sequence', 'shapes.csv', l),
        point: {
          latitude: num(sp, 'lat', 'shapes.csv', l),
          longitude: num(sp, 'lng', 'shapes.csv', l),
        },
      }))
      .sort((a, b) => a.seq - b.seq)
      .map((s) => s.point);
    if (shapePoints.length === 0)
      warnings.push(`${id}: sin shapes.csv, trazado en línea recta entre paradas`);

    return [
      need(r, 'route_id', 'patterns.csv', line),
      {
        id,
        direction: direction as RoutePattern['direction'],
        headsign: need(r, 'headsign', 'patterns.csv', line),
        quality: need(r, 'quality', 'patterns.csv', line) as DataQuality,
        stops: ordered.map((o, idx) => ({
          stopId: o.stopId,
          minutesFromStart: o.minutes ?? estimated[idx] ?? 0,
        })),
        shape: shapePoints.length > 0 ? shapePoints : stopPath,
      },
    ];
  });
  const patternsByRoute = groupBy(patterns, ([routeId]) => routeId);

  const serviceByRoute = groupBy(
    parseCsv(files['service.csv']).map((r, i) => ({ r, line: i + 2 })),
    ({ r }) => r.route_id,
  );

  const routes: BusRoute[] = parseCsv(files['routes.csv']).map((r, i) => {
    const line = i + 2;
    const id = need(r, 'route_id', 'routes.csv', line);
    const byDay = groupBy(serviceByRoute.get(id) ?? [], ({ r: s }) => s.days);
    const service: ServicePeriod[] = [...byDay.entries()].map(([days, rows]) => ({
      days: days as DayType,
      quality: rows[0].r.quality as DataQuality,
      headways: rows
        .map(({ r: s, line: l }) => ({
          from: need(s, 'from', 'service.csv', l),
          to: need(s, 'to', 'service.csv', l),
          everyMinutes: num(s, 'every_minutes', 'service.csv', l),
        }))
        .sort((a, b) => a.from.localeCompare(b.from)),
    }));
    return {
      id,
      shortName: need(r, 'short_name', 'routes.csv', line),
      longName: need(r, 'long_name', 'routes.csv', line),
      operator: r.operator ?? '',
      color: need(r, 'color', 'routes.csv', line),
      patterns: (patternsByRoute.get(id) ?? []).map(([, p]) => p),
      service,
    };
  });

  const known = new Set(routes.map((r) => r.id));
  for (const routeId of patternsByRoute.keys()) {
    if (!known.has(routeId)) warnings.push(`patterns.csv: ruta desconocida ${routeId} (ignorada)`);
  }
  for (const routeId of serviceByRoute.keys()) {
    if (!known.has(routeId)) warnings.push(`service.csv: ruta desconocida ${routeId} (ignorada)`);
  }

  const dataset: TransitDataset = {
    schemaVersion: 1,
    source: {
      kind: options.kind,
      description: options.description,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
    },
    stops,
    routes,
  };

  const errors = validateDataset(dataset);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, dataset, warnings };
}
