// Detecta cuándo el viajero bajó del bus para dejar de compartir solo. Función pura: recibe
// las últimas lecturas del GPS, el recorrido de la ruta y la hora actual.
import { distanceMeters, distanceToPathMeters, type LatLng } from '../data/geo';

export type LocationSample = {
  coordinate: LatLng;
  /** Milisegundos (como Date.now()). */
  timestamp: number;
  /** Velocidad que reporta el GPS en m/s; null o negativa si no la sabe. */
  speedMps: number | null;
  /** Radio de error en metros. */
  accuracy: number | null;
};

export type EndReason = 'user' | 'auto_alighted' | 'timeout';

/** Por debajo de esto se va a pie o quieto (7,2 km/h). */
export const WALKING_SPEED_MPS = 2;
/** A más de esto del recorrido, ya no se va en el bus. */
export const OFF_ROUTE_METERS = 80;
/** Cuánto tiempo seguido a pie y fuera del recorrido para dar por hecho que bajó. */
export const OFF_ROUTE_WINDOW_MS = 2 * 60_000;
/** Cerca de la parada de bajada basta con un minuto a paso de caminata. */
export const AT_STOP_METERS = 150;
export const AT_STOP_WINDOW_MS = 60_000;
/** Ningún viaje dura más que esto: se deja de compartir aunque no se detecte la bajada. */
export const MAX_TRIP_MS = 90 * 60_000;
/** Lecturas con más error que esto no sirven para decidir. */
export const MAX_ACCURACY_METERS = 100;
/** Se guardan las lecturas de los últimos minutos (lo que usan las reglas). */
export const HISTORY_MS = 5 * 60_000;

export type TripContext = {
  /** Recorrido de la ruta. */
  path: LatLng[];
  /** Parada donde se baja (la más cercana al destino), si se conoce. */
  alightStop: LatLng | null;
  startedAt: number;
};

/** Velocidad de cada lectura: la del GPS, o la calculada con la lectura anterior. */
function speeds(samples: LocationSample[]): number[] {
  return samples.map((s, i) => {
    if (s.speedMps !== null && s.speedMps >= 0) return s.speedMps;
    const prev = samples[i - 1];
    if (!prev || s.timestamp <= prev.timestamp) return 0;
    return distanceMeters(prev.coordinate, s.coordinate) / ((s.timestamp - prev.timestamp) / 1000);
  });
}

/**
 * Lecturas que cubren toda la ventana [now − windowMs, now]: hace falta al menos una lectura
 * de antes del inicio de la ventana (o justo al inicio) para saber qué pasó durante toda ella.
 */
function windowStart(samples: LocationSample[], now: number, windowMs: number, minCount: number) {
  const start = now - windowMs;
  const first = samples.findIndex((s) => s.timestamp >= start);
  if (first === -1) return null;
  // Tolerancia de 15 s: las lecturas llegan cada ~10 s.
  if (samples[first].timestamp > start + 15_000) return null;
  return samples.length - first >= minCount ? first : null;
}

/** Recorta el historial y quita lecturas imprecisas. */
export function pruneSamples(samples: LocationSample[], now: number): LocationSample[] {
  return samples.filter(
    (s) =>
      s.timestamp > now - HISTORY_MS && (s.accuracy === null || s.accuracy <= MAX_ACCURACY_METERS),
  );
}

/** Devuelve por qué termina el viaje, o null si sigue en el bus. */
export function detectTripEnd(
  samples: LocationSample[],
  trip: TripContext,
  now: number,
): Exclude<EndReason, 'user'> | null {
  if (now - trip.startedAt >= MAX_TRIP_MS) return 'timeout';
  const good = pruneSamples(samples, now).sort((a, b) => a.timestamp - b.timestamp);
  const v = speeds(good);
  const slowFrom = (i: number) => v.slice(i).every((s) => s < WALKING_SPEED_MPS);

  // 1. Dos minutos a pie (o quieto) y lejos del recorrido: ya no va en el bus.
  const off = windowStart(good, now, OFF_ROUTE_WINDOW_MS, 3);
  if (
    off !== null &&
    slowFrom(off) &&
    good.slice(off).every((s) => distanceToPathMeters(s.coordinate, trip.path) > OFF_ROUTE_METERS)
  ) {
    return 'auto_alighted';
  }

  // 2. Un minuto a paso de caminata junto a la parada de bajada.
  const stop = trip.alightStop;
  const near = windowStart(good, now, AT_STOP_WINDOW_MS, 2);
  if (
    stop &&
    near !== null &&
    slowFrom(near) &&
    good.slice(near).every((s) => distanceMeters(s.coordinate, stop) <= AT_STOP_METERS)
  ) {
    return 'auto_alighted';
  }
  return null;
}

/** Más lento que esto se considera quieto (3,6 km/h). */
export const STUCK_SPEED_MPS = 1;
/** Cuánto tiempo quieto sobre el recorrido para preguntar "¿Se varó el bus?". */
export const STUCK_WINDOW_MS = 5 * 60_000;

/**
 * El bus lleva 5 minutos quieto SOBRE el recorrido y lejos de la parada de bajada: puede
 * estar varado (o en un trancón). Solo sirve para preguntarle al viajero, no para decidir.
 */
export function detectStuck(samples: LocationSample[], trip: TripContext, now: number): boolean {
  const good = pruneSamples(samples, now).sort((a, b) => a.timestamp - b.timestamp);
  const from = windowStart(good, now, STUCK_WINDOW_MS, 4);
  if (from === null) return false;
  const v = speeds(good);
  const recent = good.slice(from);
  if (!v.slice(from).every((s) => s < STUCK_SPEED_MPS)) return false;
  if (!recent.every((s) => distanceToPathMeters(s.coordinate, trip.path) <= OFF_ROUTE_METERS)) {
    return false;
  }
  const last = recent[recent.length - 1];
  return !trip.alightStop || distanceMeters(last.coordinate, trip.alightStop) > AT_STOP_METERS;
}
