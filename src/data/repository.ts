// Capa de acceso a los datos de rutas. Las pantallas solo hablan con `routesRepository`.
//
// Al arrancar trabaja con src/data/dataset.json (incluido en la app, generado con
// `npm run data:seed`). src/data/transitSync.ts lo reemplaza por la copia guardada en el
// teléfono si es más nueva, y descarga del backend la versión actual para el siguiente
// arranque. La interfaz es síncrona: trabaja sobre un conjunto de datos ya en memoria.
import rawDataset from './dataset.json';
import { distanceMeters, type LatLng } from './geo';
import type { BusRoute, RoutePattern, Stop, TransitDataset } from './model';
import { nextDepartures, type ScheduleOptions } from './schedule';
import { parseDataset } from './validate';

/** Parada de un recorrido con sus datos completos. */
export type PatternStopInfo = Stop & { minutesFromStart: number };

export type RoutesRepository = {
  source(): TransitDataset['source'];
  /** Todas las rutas, en el orden del conjunto de datos. */
  listRoutes(): BusRoute[];
  getRoute(id: string): BusRoute | undefined;
  getStop(id: string): Stop | undefined;
  /** Recorrido de la ruta en un sentido (0 = hacia la universidad). */
  getPattern(routeId: string, direction?: 0 | 1): RoutePattern | undefined;
  /** Paradas del recorrido en orden, con nombre y coordenadas. */
  getPatternStops(routeId: string, direction?: 0 | 1): PatternStopInfo[];
  /** Parada del recorrido más cercana a un punto (ej. la ubicación del usuario). */
  nearestPatternStop(
    routeId: string,
    point: LatLng,
    direction?: 0 | 1,
  ): PatternStopInfo | undefined;
  /** Rutas que pasan a menos de `maxMeters` de un punto. */
  routesNear(point: LatLng, maxMeters: number): BusRoute[];
  /**
   * Próximos pasos de la ruta por una parada según el horario (no es tiempo real).
   * Sin `stopId`, son las salidas desde la cabecera.
   */
  nextDepartures(
    routeId: string,
    from: Date,
    options?: ScheduleOptions & { count?: number; stopId?: string; direction?: 0 | 1 },
  ): Date[];
};

export function createRoutesRepository(dataset: TransitDataset): RoutesRepository {
  const routes = new Map(dataset.routes.map((r) => [r.id, r]));
  const stops = new Map(dataset.stops.map((s) => [s.id, s]));

  const getPattern = (routeId: string, direction: 0 | 1 = 0) =>
    routes.get(routeId)?.patterns.find((p) => p.direction === direction);

  const getPatternStops = (routeId: string, direction: 0 | 1 = 0): PatternStopInfo[] =>
    (getPattern(routeId, direction)?.stops ?? []).flatMap((ps) => {
      const stop = stops.get(ps.stopId);
      return stop ? [{ ...stop, minutesFromStart: ps.minutesFromStart }] : [];
    });

  const nearestPatternStop = (routeId: string, point: LatLng, direction: 0 | 1 = 0) => {
    let best: PatternStopInfo | undefined;
    let bestDistance = Infinity;
    for (const stop of getPatternStops(routeId, direction)) {
      const d = distanceMeters(point, stop.coordinate);
      if (d < bestDistance) {
        best = stop;
        bestDistance = d;
      }
    }
    return best;
  };

  return {
    source: () => dataset.source,
    listRoutes: () => dataset.routes,
    getRoute: (id) => routes.get(id),
    getStop: (id) => stops.get(id),
    getPattern,
    getPatternStops,
    nearestPatternStop,
    routesNear: (point, maxMeters) =>
      dataset.routes.filter((route) =>
        route.patterns.some((p) =>
          p.stops.some((ps) => {
            const stop = stops.get(ps.stopId);
            return stop !== undefined && distanceMeters(point, stop.coordinate) <= maxMeters;
          }),
        ),
      ),
    nextDepartures: (routeId, from, options = {}) => {
      const route = routes.get(routeId);
      if (!route) return [];
      const { count = 3, stopId, direction = 0, ...schedule } = options;
      let offset = 0;
      if (stopId) {
        const ps = getPattern(routeId, direction)?.stops.find((s) => s.stopId === stopId);
        if (!ps) return [];
        offset = ps.minutesFromStart;
      }
      return nextDepartures(route, from, count, offset, schedule);
    },
  };
}

/** Datos incluidos en la app. Falla al arrancar si dataset.json no es válido. */
export const BUNDLED_DATASET: TransitDataset = parseDataset(rawDataset);

let active = { dataset: BUNDLED_DATASET, repo: createRoutesRepository(BUNDLED_DATASET) };

/** Cambia los datos que usa la app. Llamar antes de mostrar pantallas (ver transitSync.ts). */
export function setActiveDataset(dataset: TransitDataset): void {
  active = { dataset, repo: createRoutesRepository(dataset) };
}

export function getActiveDataset(): TransitDataset {
  return active.dataset;
}

/** Repositorio de la app: siempre delega en los datos activos. */
export const routesRepository: RoutesRepository = {
  source: () => active.repo.source(),
  listRoutes: () => active.repo.listRoutes(),
  getRoute: (id) => active.repo.getRoute(id),
  getStop: (id) => active.repo.getStop(id),
  getPattern: (routeId, direction) => active.repo.getPattern(routeId, direction),
  getPatternStops: (routeId, direction) => active.repo.getPatternStops(routeId, direction),
  nearestPatternStop: (routeId, point, direction) =>
    active.repo.nearestPatternStop(routeId, point, direction),
  routesNear: (point, maxMeters) => active.repo.routesNear(point, maxMeters),
  nextDepartures: (routeId, from, options) => active.repo.nextDepartures(routeId, from, options),
};

/** Ruta por defecto cuando no hay una elegida o el id ya no existe. */
export const DEFAULT_ROUTE_ID = 'T2';

/** Busca la ruta y, si no existe, devuelve la ruta por defecto (o la primera). */
export function getRouteOrDefault(id: string): BusRoute {
  return (
    routesRepository.getRoute(id) ??
    routesRepository.getRoute(DEFAULT_ROUTE_ID) ??
    routesRepository.listRoutes()[0]
  );
}
