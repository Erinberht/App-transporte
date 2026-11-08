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

/**
 * Distancia en metros de un punto a una línea quebrada (el recorrido de una ruta).
 * Proyección plana local: suficiente para distancias de pocos kilómetros.
 */
export function distanceToPathMeters(point: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return distanceMeters(point, path[0]);
  const mPerLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const mPerLng = mPerLat * Math.cos(toRad(point.latitude));
  const xy = (p: LatLng) => ({
    x: (p.longitude - point.longitude) * mPerLng,
    y: (p.latitude - point.latitude) * mPerLat,
  });
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = xy(path[i - 1]);
    const b = xy(path[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    // Punto del segmento más cercano al origen (que es `point`).
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
}
