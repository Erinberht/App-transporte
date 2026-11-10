import { DESTINATIONS } from './destinations';
import { distanceMeters, regionFor, type LatLng } from './geo';
import type { DataQuality } from './model';
import { getRouteOrDefault, routesRepository } from './repository';

export type TripMapData = {
  /** Polilínea del recorrido de la ruta. */
  path: LatLng[];
  /** Parada donde el usuario toma el bus. */
  userStop: LatLng;
  /** Parada de bajada: la más cercana al destino (como en el motor de recomendación). */
  destinationStop: LatLng;
  /** Posición del bus. MUESTRA: un punto antes de la parada del usuario (sin tiempo real aún). */
  busPosition: LatLng;
  region: ReturnType<typeof regionFor>;
  quality: DataQuality;
};

function nearestIndex(path: LatLng[], point: LatLng): number {
  let best = 0;
  path.forEach((p, i) => {
    if (distanceMeters(p, point) < distanceMeters(path[best], point)) best = i;
  });
  return best;
}

/** Lo que dibuja el mapa para una ruta, según la ubicación del usuario si la hay. */
export function tripMapData(
  routeId: string | undefined,
  origin: LatLng | null = null,
  /** Destino del viaje; sin valor, la universidad. */
  destination: LatLng = DESTINATIONS[0].coordinate,
  /** Parada de subida elegida por el motor de recomendación (src/planner). */
  boardStopId?: string,
): TripMapData {
  const route = getRouteOrDefault(routeId ?? '');
  const pattern = routesRepository.getPattern(route.id);
  const stops = routesRepository.getPatternStops(route.id);
  const path = pattern?.shape ?? stops.map((s) => s.coordinate);
  const destinationStop =
    routesRepository.nearestPatternStop(route.id, destination)?.coordinate ?? path[path.length - 1];
  // Sin ubicación se usa la primera parada (cabecera) como parada de muestra.
  const userStop =
    (boardStopId && stops.find((s) => s.id === boardStopId)?.coordinate) ||
    (origin && routesRepository.nearestPatternStop(route.id, origin)?.coordinate) ||
    stops[0]?.coordinate ||
    path[0];

  const userIndex = nearestIndex(path, userStop);
  const previous = path[Math.max(userIndex - 1, 0)];
  const busPosition =
    userIndex === 0
      ? path[0]
      : {
          latitude: (previous.latitude + userStop.latitude) / 2,
          longitude: (previous.longitude + userStop.longitude) / 2,
        };

  return {
    path,
    userStop,
    destinationStop,
    busPosition,
    region: regionFor(path),
    quality: pattern?.quality ?? 'ficticio',
  };
}
