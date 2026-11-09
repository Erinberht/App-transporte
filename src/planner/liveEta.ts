// Hora de llegada EN VIVO: dónde va cada bus (según los viajeros que comparten) y cuántos
// minutos le faltan para llegar a tu parada, usando los minutos del recorrido entre paradas.
import { distanceMeters, distanceToPathMeters, type LatLng } from '../data/geo';
import type { PatternStopInfo } from '../data/repository';

/** Un bus a más de esto del recorrido no se usa (posición dudosa o va por otra calle). */
export const ON_ROUTE_METERS = 150;

/** Distancia recorrida a lo largo de la línea hasta el punto de la línea más cercano a `p`. */
function along(path: LatLng[], p: LatLng): number {
  let best = { d: Infinity, at: 0 };
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = distanceMeters(a, b);
    const d = distanceToPathMeters(p, [a, b]);
    if (d < best.d) {
      // Avance dentro del segmento: proporción de la distancia a "a" sobre el largo.
      const da = distanceMeters(a, p);
      const offset = Math.min(len, Math.sqrt(Math.max(0, da * da - d * d)));
      best = { d, at: acc + offset };
    }
    acc += len;
  }
  return best.at;
}

/** Minutos desde el inicio del recorrido en el punto `p` (interpolando entre paradas). */
export function minutesAlong(path: LatLng[], stops: PatternStopInfo[], p: LatLng): number {
  const marks = stops.map((s) => ({ at: along(path, s.coordinate), min: s.minutesFromStart }));
  const x = along(path, p);
  if (x <= marks[0].at) return marks[0].min;
  for (let i = 1; i < marks.length; i++) {
    const a = marks[i - 1];
    const b = marks[i];
    if (x <= b.at)
      return b.at === a.at ? b.min : a.min + ((x - a.at) / (b.at - a.at)) * (b.min - a.min);
  }
  return marks[marks.length - 1].min;
}

/**
 * Minutos que le faltan al bus más cercano (que aún no pasó) para llegar a `boardStop`, solo
 * entre los que el viajero alcanza a tomar (`minMinutes`: lo que tarda en llegar a la parada).
 * null si ningún bus en vivo sirve.
 */
export function nextLiveArrival(
  buses: LatLng[],
  path: LatLng[],
  stops: PatternStopInfo[],
  boardStop: PatternStopInfo,
  minMinutes = 0,
): number | null {
  if (path.length < 2 || stops.length < 2) return null;
  let best: number | null = null;
  for (const bus of buses) {
    if (distanceToPathMeters(bus, path) > ON_ROUTE_METERS) continue;
    const eta = boardStop.minutesFromStart - minutesAlong(path, stops, bus);
    if (eta < -0.5 || eta < minMinutes) continue; // ya pasó o no lo alcanzas
    const rounded = Math.max(0, Math.round(eta));
    if (best === null || rounded < best) best = rounded;
  }
  return best;
}
