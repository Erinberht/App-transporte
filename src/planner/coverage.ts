import { distanceMeters, type LatLng } from '../data/geo';
import type { RoutesRepository } from '../data/repository';
import { routesRepository } from '../data/repository';
import { MAX_ALIGHT_DISTANCE_METERS } from './recommend';

/**
 * ¿Alguna de las rutas cargadas pasa cerca de este punto? Mismo criterio que usa el motor para
 * bajarse cerca del destino. Sirve para avisar al guardar un lugar que ninguna ruta llega ahí.
 */
export function servedByAnyRoute(
  point: LatLng,
  repo: RoutesRepository = routesRepository,
): boolean {
  return repo.listRoutes().some((route) => {
    const stop = repo.nearestPatternStop(route.id, point);
    return (
      stop !== undefined && distanceMeters(stop.coordinate, point) <= MAX_ALIGHT_DISTANCE_METERS
    );
  });
}
