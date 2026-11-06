import type { Occupancy, Route } from '../types';

// Datos de muestra. Más adelante vendrán de la API (rutas, GPS de busetas y reportes).
export const ROUTES: Route[] = [
  { id: 'P1', name: 'P1', etaMinutes: 9 },
  { id: 'P2', name: 'P2', etaMinutes: 12 },
  { id: 'T2', name: 'T2', etaMinutes: 5 },
  { id: 'RG', name: 'Rancho Grande', etaMinutes: 15, notice: 'Rancho Grande: sin reportes' },
];

export const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  full: 'Lleno',
  medium: 'Medio',
  empty: 'Vacío',
};

export function getRoute(id: string): Route {
  return ROUTES.find((r) => r.id === id) ?? ROUTES[0];
}
