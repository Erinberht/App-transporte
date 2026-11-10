// Motor de recomendación: dado origen, destino y hora de entrada a clase, calcula para cada
// ruta caminata a la parada + espera + trayecto + caminata final, y las ordena por la que te
// deja llegar a tiempo con más margen. Función pura: la hora actual y los datos se inyectan.
//
// Las opciones de caminata siguen las de Moovit: ritmo normal o lento (lento = el doble de
// tiempo en cada tramo a pie) y duración máxima por tramo de 2 a 16 minutos, sin límite por
// defecto. La velocidad base es supuesto nuestro (Moovit no la publica).
import { distanceMeters, type LatLng } from '../data/geo';
import type { PatternStopInfo, RoutesRepository } from '../data/repository';
import type { ClassTime } from '../lib/classTime';

export type WalkingPace = 'normal' | 'slow';

export type WalkingPrefs = {
  pace: WalkingPace;
  /** Máximo de minutos por tramo a pie (2 a 16), o null = sin límite. */
  maxWalkMinutes: number | null;
};

export const DEFAULT_WALKING: WalkingPrefs = { pace: 'normal', maxWalkMinutes: null };
export const MIN_WALK_LIMIT = 2;
export const MAX_WALK_LIMIT = 16;

/** Velocidad a pie con ritmo normal. */
export const WALK_SPEED_KMH = 4.5;
/** Las calles no van en línea recta: distancia real ≈ 1,3 × distancia en línea recta. */
export const DETOUR_FACTOR = 1.3;
/** Si el campus está a menos de esto (a pie, por calles), se sugiere ir caminando. */
export const WALK_INSTEAD_METERS = 600;
/**
 * Si la parada más cercana al destino queda más lejos que esto (en línea recta), la ruta no
 * llega a ese lugar. Importa para los lugares del usuario (etapa 4.1): sin límite de caminata,
 * el motor no debe proponer bajarse a 3 km de la casa.
 */
export const MAX_ALIGHT_DISTANCE_METERS = 1200;
/** Margen desde el que se dice "Llegas N min antes" (por debajo es "Llegas justo"). */
export const COMFORT_MINUTES = 5;
/** Con más anticipación que esto se sugiere a qué hora salir, en vez de salir ya. */
export const PLAN_AHEAD_MINUTES = 90;
/** Colchón para la hora de salida sugerida. */
export const SAFETY_BUFFER_MINUTES = 10;
/** Si el próximo bus tarda más que esto, la ruta "no opera a esta hora". */
export const MAX_WAIT_MINUTES = 120;
/** Si la clase empezó hace más que esto, se entiende que es la de mañana. */
export const LATE_GRACE_MINUTES = 60;

const MINUTE = 60_000;
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * MINUTE);
const minutesBetween = (from: Date, to: Date) =>
  Math.floor((to.getTime() - from.getTime()) / MINUTE);

/** Minutos a pie entre dos puntos (redondeado hacia arriba). */
export function walkMinutes(a: LatLng, b: LatLng, prefs: WalkingPrefs = DEFAULT_WALKING): number {
  const meters = distanceMeters(a, b) * DETOUR_FACTOR;
  const minutes = meters / ((WALK_SPEED_KMH * 1000) / 60);
  return Math.ceil(minutes * (prefs.pace === 'slow' ? 2 : 1));
}

/** Fecha y hora de la clase: hoy, o mañana si ya pasó hace más de LATE_GRACE_MINUTES. */
export function resolveArriveBy({ hours, minutes }: ClassTime, now: Date): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  if (minutesBetween(today, now) > LATE_GRACE_MINUTES) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes);
  }
  return today;
}

export type ArrivalStatus = 'early' | 'just' | 'late';

export function statusForMargin(marginMinutes: number): ArrivalStatus {
  if (marginMinutes < 0) return 'late';
  return marginMinutes >= COMFORT_MINUTES ? 'early' : 'just';
}

export type TripOption = {
  kind: 'trip';
  routeId: string;
  boardStop: PatternStopInfo;
  alightStop: PatternStopInfo;
  walkToStopMinutes: number;
  rideMinutes: number;
  walkFromStopMinutes: number;
  /** Hora de salir del origen para alcanzar el bus. */
  leaveAt: Date;
  /** Hora en que pasa el bus por la parada de subida. */
  boardAt: Date;
  arriveAt: Date;
  /** Minutos entre la llegada y la hora de clase (negativo = tarde). */
  marginMinutes: number;
  status: ArrivalStatus;
  /** Solo si falta mucho para la clase: hora límite para salir y llegar con colchón. */
  latestLeaveAt?: Date;
};

export type UnavailableReason =
  /** Alguna caminata supera el límite elegido. */
  | 'walk_limit'
  /** No pasa un bus pronto (fuera de horario, domingo...). */
  | 'no_service'
  /** El recorrido no sirve para este viaje (ej. no pasa antes por una parada útil). */
  | 'no_path';

export type UnavailableOption = {
  kind: 'unavailable';
  routeId: string;
  reason: UnavailableReason;
  /** Minutos a pie hasta la parada más cercana (para explicar 'walk_limit'). */
  nearestWalkMinutes?: number;
};

export type RouteOption = TripOption | UnavailableOption;

export type PlanInput = {
  repo: RoutesRepository;
  origin: LatLng;
  destination: LatLng;
  arriveBy: Date;
  now: Date;
  walking?: WalkingPrefs;
};

export type Plan = {
  arriveBy: Date;
  /** Ordenadas: a tiempo (más margen primero), tarde (menos tarde primero), no disponibles. */
  options: RouteOption[];
  /** Si el campus queda tan cerca que conviene caminar. */
  walkInstead?: { minutes: number; arriveAt: Date };
};

function exceeds(minutes: number, prefs: WalkingPrefs) {
  return prefs.maxWalkMinutes !== null && minutes > prefs.maxWalkMinutes;
}

function planRoute(routeId: string, input: Required<PlanInput>): RouteOption {
  const { repo, origin, destination, now, arriveBy, walking } = input;
  const stops = repo.getPatternStops(routeId);
  if (stops.length < 2) return { kind: 'unavailable', routeId, reason: 'no_path' };

  // Bajada: la parada del recorrido más cercana al destino.
  let alightIndex = 0;
  stops.forEach((s, i) => {
    if (
      distanceMeters(s.coordinate, destination) <
      distanceMeters(stops[alightIndex].coordinate, destination)
    ) {
      alightIndex = i;
    }
  });
  if (alightIndex === 0) return { kind: 'unavailable', routeId, reason: 'no_path' };
  const alightStop = stops[alightIndex];
  if (distanceMeters(alightStop.coordinate, destination) > MAX_ALIGHT_DISTANCE_METERS) {
    return { kind: 'unavailable', routeId, reason: 'no_path' };
  }
  const walkFrom = walkMinutes(alightStop.coordinate, destination, walking);

  // Subida: cualquier parada antes de la de bajada; gana la que llega antes.
  const boardable = stops.slice(0, alightIndex).map((stop) => ({
    stop,
    walkTo: walkMinutes(origin, stop.coordinate, walking),
  }));
  const nearestWalk = Math.min(...boardable.map((b) => b.walkTo));
  const withinLimit = boardable.filter((b) => !exceeds(b.walkTo, walking));
  if (withinLimit.length === 0 || exceeds(walkFrom, walking)) {
    return {
      kind: 'unavailable',
      routeId,
      reason: 'walk_limit',
      nearestWalkMinutes: Math.max(nearestWalk, walkFrom),
    };
  }

  let best: TripOption | undefined;
  for (const { stop, walkTo } of withinLimit) {
    const atStop = addMinutes(now, walkTo);
    const [boardAt] = repo.nextDepartures(routeId, atStop, { stopId: stop.id, count: 1 });
    if (!boardAt || minutesBetween(atStop, boardAt) > MAX_WAIT_MINUTES) continue;
    const rideMinutes = Math.round(alightStop.minutesFromStart - stop.minutesFromStart);
    const arriveAt = addMinutes(boardAt, rideMinutes + walkFrom);
    const marginMinutes = minutesBetween(arriveAt, arriveBy);
    const option: TripOption = {
      kind: 'trip',
      routeId,
      boardStop: stop,
      alightStop,
      walkToStopMinutes: walkTo,
      rideMinutes,
      walkFromStopMinutes: walkFrom,
      leaveAt: addMinutes(boardAt, -walkTo),
      boardAt,
      arriveAt,
      marginMinutes,
      status: statusForMargin(marginMinutes),
    };
    if (
      !best ||
      option.arriveAt < best.arriveAt ||
      (option.arriveAt.getTime() === best.arriveAt.getTime() && walkTo < best.walkToStopMinutes)
    ) {
      best = option;
    }
  }
  if (!best) return { kind: 'unavailable', routeId, reason: 'no_service' };

  if (minutesBetween(now, arriveBy) > PLAN_AHEAD_MINUTES) {
    best.latestLeaveAt = latestLeaveAt(best, input);
  }
  return best;
}

/** Último bus (por la misma parada) que aún llega con SAFETY_BUFFER_MINUTES de colchón. */
function latestLeaveAt(option: TripOption, input: Required<PlanInput>): Date | undefined {
  const deadline = addMinutes(input.arriveBy, -SAFETY_BUFFER_MINUTES);
  const legs = option.rideMinutes + option.walkFromStopMinutes;
  const departures = input.repo.nextDepartures(option.routeId, option.boardAt, {
    stopId: option.boardStop.id,
    count: 500,
  });
  let latest: Date | undefined;
  for (const boardAt of departures) {
    if (addMinutes(boardAt, legs) > deadline) break;
    latest = boardAt;
  }
  return latest ? addMinutes(latest, -option.walkToStopMinutes) : undefined;
}

function compare(a: RouteOption, b: RouteOption): number {
  const rank = (o: RouteOption) => (o.kind === 'unavailable' ? 2 : o.marginMinutes >= 0 ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.kind === 'unavailable' || b.kind === 'unavailable') return 0; // orden del catálogo
  if (a.marginMinutes !== b.marginMinutes) return b.marginMinutes - a.marginMinutes;
  const walkA = a.walkToStopMinutes + a.walkFromStopMinutes;
  const walkB = b.walkToStopMinutes + b.walkFromStopMinutes;
  if (walkA !== walkB) return walkA - walkB;
  return a.rideMinutes - b.rideMinutes;
}

export function recommendRoutes(input: PlanInput): Plan {
  const full: Required<PlanInput> = { walking: DEFAULT_WALKING, ...input };
  const options = full.repo
    .listRoutes()
    .map((route) => planRoute(route.id, full))
    .sort(compare); // sort estable: los empates mantienen el orden del catálogo

  const plan: Plan = { arriveBy: full.arriveBy, options };
  if (distanceMeters(full.origin, full.destination) * DETOUR_FACTOR <= WALK_INSTEAD_METERS) {
    const minutes = walkMinutes(full.origin, full.destination, full.walking);
    plan.walkInstead = { minutes, arriveAt: addMinutes(full.now, minutes) };
  }
  return plan;
}

/** Texto de la etiqueta de llegada, ej. "Llegas 15 min antes". */
export function arrivalLabel(option: Pick<TripOption, 'status' | 'marginMinutes'>): string {
  if (option.status === 'late') return `Llegas tarde · ${-option.marginMinutes} min`;
  if (option.status === 'just') return 'Llegas justo';
  return `Llegas ${option.marginMinutes} min antes`;
}

/** Explicación de por qué una ruta no sirve. */
export function unavailableLabel(option: UnavailableOption): string {
  if (option.reason === 'walk_limit') {
    return option.nearestWalkMinutes !== undefined
      ? `Caminata de ${option.nearestWalkMinutes} min (supera tu límite)`
      : 'Caminata más larga que tu límite';
  }
  if (option.reason === 'no_service') return 'No opera a esta hora';
  return 'No te sirve para este viaje';
}

/**
 * Aviso cuando ninguna de las rutas cargadas sirve para el destino. null si al menos una
 * sirve o si conviene ir caminando (ese aviso ya se muestra aparte).
 */
export function noRouteNotice(plan: Plan, destinationName: string): string | null {
  if (plan.walkInstead || plan.options.some((o) => o.kind === 'trip')) return null;
  const reasons = new Set(
    plan.options.map((o) => (o.kind === 'unavailable' ? o.reason : 'no_path')),
  );
  if (reasons.size === 1 && reasons.has('no_path')) {
    return `Ninguna de las rutas cargadas llega cerca de ${destinationName}.`;
  }
  const base = `Ninguna ruta te sirve ahora para llegar a ${destinationName}.`;
  return reasons.has('walk_limit')
    ? `${base} Prueba con un límite de caminata mayor en tu perfil.`
    : base;
}
