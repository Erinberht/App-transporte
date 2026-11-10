import { useMemo, useState } from 'react';

import { routesRepository } from '../data/repository';
import { useTrip } from '../state/trip';
import { recommendRoutes, resolveArriveBy, type Plan, type TripOption } from './recommend';

/**
 * Plan del viaje actual según el estado (origen, destino, hora de llegada, caminata).
 * Sin ubicación devuelve null: no se puede calcular la caminata a la parada.
 * La hora de referencia es la de cuando se abrió la pantalla.
 */
export function useRoutePlan(now?: Date): Plan | null {
  const { origin, destination, classTime, walking } = useTrip();
  const [openedAt] = useState(() => now ?? new Date());
  return useMemo(() => {
    if (!origin) return null;
    return recommendRoutes({
      repo: routesRepository,
      origin,
      destination: destination.coordinate,
      arriveBy: resolveArriveBy(classTime, openedAt),
      now: openedAt,
      walking,
    });
  }, [origin, destination, classTime, walking, openedAt]);
}

/** Opción calculada para una ruta, si es un viaje posible. */
export function tripOptionFor(plan: Plan | null, routeId: string): TripOption | undefined {
  const option = plan?.options.find((o) => o.routeId === routeId);
  return option?.kind === 'trip' ? option : undefined;
}
