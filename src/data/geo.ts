// Utilidades geográficas. Sin importaciones de valores para que Node pueda usarlo desde
// scripts/import-routes.ts sin compilar.
import type { LatLng } from './model';

export type { LatLng };

/** Centro aproximado de Montería (Córdoba, Colombia). */
export const MONTERIA_CENTER: LatLng = { latitude: 8.7575, longitude: -75.8851 };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia en metros entre dos puntos (fórmula de haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Región que encuadra todos los puntos, con un margen alrededor. */
export function regionFor(points: LatLng[], padding = 1.4) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * padding, 0.005),
    longitudeDelta: Math.max((maxLng - minLng) * padding, 0.005),
  };
}
