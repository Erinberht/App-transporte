// "Compartir mi recorrido": coordina el GPS, el envío al servidor y la detección de bajada.
// No depende de React porque la tarea de ubicación en segundo plano también lo usa. El GPS y
// el servidor se inyectan para poder probarlo sin teléfono ni red.
//
// Sin persistencia a propósito: si el sistema cierra la app, el servicio de ubicación muere con
// ella y el servidor cierra el viaje a los 10 minutos sin posiciones (close_stale_trips).
import { distanceMeters, type LatLng } from '../data/geo';
import { isInMonteria } from '../data/validate';
import type { Occupancy } from '../types';
import {
  detectTripEnd,
  MAX_ACCURACY_METERS,
  pruneSamples,
  type EndReason,
  type LocationSample,
} from './alighting';

/** Con permiso "todo el tiempo" se sigue compartiendo con la pantalla apagada. */
export type LocationMode = 'background' | 'foreground';

export interface LocationTracker {
  /** Pide los permisos que falten y dice en qué modo se puede compartir. */
  requestPermission(): Promise<LocationMode | 'denied' | 'services_off'>;
  start(
    mode: LocationMode,
    label: string,
    onSamples: (samples: LocationSample[]) => void,
  ): Promise<void>;
  stop(): Promise<void>;
}

export interface ShareBackend {
  startTrip(routeId: string, busId: string | null): Promise<string>;
  endTrip(tripId: string, reason: EndReason): Promise<void>;
  /**
   * Debe lanzar un error con name 'TripClosedError' si el servidor ya cerró el viaje, o con
   * name 'PositionRejectedError' y `reason` si rechazó la posición (ver SendProblem).
   */
  sendPosition(tripId: string, sample: LocationSample): Promise<void>;
  /** Debe lanzar name 'OccupancyLimitError' con `reason` si el servidor aplica su límite. */
  reportOccupancy(tripId: string, routeId: string, level: Occupancy): Promise<void>;
}

/** Resultado de reportar el cupo. */
export type OccupancyReportResult =
  | { kind: 'sent' }
  /** Hay que esperar: un reporte cada 2 minutos por viaje. */
  | { kind: 'too_soon'; waitMinutes: number }
  /** Ya se enviaron los 10 reportes permitidos en este viaje. */
  | { kind: 'max_reached' }
  /** Solo se reporta mientras se comparte el recorrido (hace falta un viaje activo). */
  | { kind: 'not_sharing' }
  | { kind: 'offline' };

/** Límites del servidor (check_occupancy_report), revisados también aquí para avisar antes. */
export const OCCUPANCY_INTERVAL_MS = 2 * 60_000;
export const MAX_OCCUPANCY_REPORTS = 10;

/** Por qué no está llegando la posición al servidor. */
export type SendProblem =
  /** Sin internet o el servidor no respondió. */
  | 'no_signal'
  /** La posición está fuera de Montería: el servidor no la acepta (ni se intenta enviar). */
  | 'outside_area'
  /** La hora del teléfono está desfasada: la posición parece vieja o del futuro. */
  | 'clock'
  /** El servidor la rechazó por otro motivo. */
  | 'rejected';

export type ShareError =
  /** La app no tiene backend configurado. */
  | 'no_backend'
  /** El usuario no dio permiso de ubicación. */
  | 'permission'
  /** El GPS del teléfono está apagado. */
  | 'location_off'
  /** No se pudo crear el viaje en el servidor (sin conexión...). */
  | 'network';

export type ShareStatus =
  | { state: 'idle' }
  | { state: 'starting'; routeId: string }
  | {
      state: 'sharing';
      routeId: string;
      tripId: string;
      mode: LocationMode;
      startedAt: number;
      /** Hora del último envío que llegó al servidor. */
      lastSentAt: number | null;
      /** Por qué falló el último envío (se reintenta con la próxima lectura), o null. */
      problem: SendProblem | null;
    }
  | {
      state: 'ended';
      routeId: string;
      reason: EndReason;
      /** Cuánto tiempo se compartió (null si se detuvo antes de empezar). */
      sharedMs: number | null;
    }
  | { state: 'error'; routeId: string; error: ShareError };

export type StartOptions = {
  routeId: string;
  /** Texto para la notificación de Android, ej. "Ruta P3". */
  label: string;
  /** Recorrido de la ruta y parada de bajada: para detectar que el viajero bajó. */
  path: LatLng[];
  alightStop: LatLng | null;
  /** Bus vinculado al escanear su QR (opcional). */
  busId?: string | null;
};

/** Como mucho un envío cada 10 s... */
export const MIN_SEND_INTERVAL_MS = 10_000;
/** ...y solo si se movió 25 m... */
export const MIN_SEND_DISTANCE_M = 25;
/** ...o si pasó un minuto (así el bus no "desaparece" del mapa en un trancón). */
export const HEARTBEAT_MS = 60_000;

export type ShareSession = ReturnType<typeof createShareSession>;

export function createShareSession(deps: {
  backend: () => ShareBackend | null;
  tracker: LocationTracker;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  let status: ShareStatus = { state: 'idle' };
  const listeners = new Set<() => void>();
  // Cada inicio o fin incrementa la generación: un inicio que termina tarde no revive un
  // viaje que el usuario ya detuvo.
  let generation = 0;
  let context: { path: LatLng[]; alightStop: LatLng | null } | null = null;
  let history: LocationSample[] = [];
  let lastSent: LocationSample | null = null;
  let sending = false;
  let lastOptions: StartOptions | null = null;
  let occupancy = { tripId: '', count: 0, lastAt: 0 };

  function set(next: ShareStatus) {
    status = next;
    listeners.forEach((l) => l());
  }

  async function start(options: StartOptions): Promise<void> {
    if (status.state === 'starting' || status.state === 'sharing') return;
    const gen = ++generation;
    lastOptions = options;
    const { routeId } = options;
    set({ state: 'starting', routeId });

    const backend = deps.backend();
    if (!backend) return set({ state: 'error', routeId, error: 'no_backend' });

    let mode: LocationMode;
    try {
      const permission = await deps.tracker.requestPermission();
      if (gen !== generation) return;
      if (permission === 'denied') return set({ state: 'error', routeId, error: 'permission' });
      if (permission === 'services_off') {
        return set({ state: 'error', routeId, error: 'location_off' });
      }
      mode = permission;
    } catch {
      return set({ state: 'error', routeId, error: 'permission' });
    }

    let tripId: string;
    try {
      tripId = await backend.startTrip(routeId, options.busId ?? null);
    } catch {
      if (gen === generation) set({ state: 'error', routeId, error: 'network' });
      return;
    }
    if (gen !== generation) {
      // El usuario detuvo mientras se creaba el viaje.
      backend.endTrip(tripId, 'user').catch(() => {});
      return;
    }

    context = { path: options.path, alightStop: options.alightStop };
    history = [];
    lastSent = null;
    const startedAt = now();
    set({
      state: 'sharing',
      routeId,
      tripId,
      mode,
      startedAt,
      lastSentAt: null,
      problem: null,
    });
    try {
      await deps.tracker.start(mode, options.label, handleSamples);
    } catch {
      if (gen === generation) await finish('user', { error: 'permission' });
    }
  }

  /** Lecturas nuevas del GPS (de la app abierta o de la tarea en segundo plano). */
  function handleSamples(samples: LocationSample[]) {
    if (status.state !== 'sharing' || !context) {
      // Lecturas huérfanas (por ejemplo, tras recargar la app): se apaga el GPS.
      deps.tracker.stop().catch(() => {});
      return;
    }
    const t = now();
    history = pruneSamples([...history, ...samples], t);

    const end = detectTripEnd(history, { ...context, startedAt: status.startedAt }, t);
    if (end) {
      finish(end);
      return;
    }

    const latest = samples
      .filter((s) => s.accuracy === null || s.accuracy <= MAX_ACCURACY_METERS)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!latest) return;
    if (!isInMonteria(latest.coordinate)) {
      // El servidor la rechazaría: ni se intenta. Al entrar a Montería se envía sola.
      if (status.problem !== 'outside_area') set({ ...status, problem: 'outside_area' });
      return;
    }
    if (shouldSend(latest, t)) send(latest);
  }

  function shouldSend(sample: LocationSample, t: number) {
    if (sending) return false;
    if (status.state !== 'sharing') return false;
    if (!lastSent || status.lastSentAt === null || status.problem) return true;
    const elapsed = t - status.lastSentAt;
    if (elapsed < MIN_SEND_INTERVAL_MS) return false;
    return (
      elapsed >= HEARTBEAT_MS ||
      distanceMeters(lastSent.coordinate, sample.coordinate) >= MIN_SEND_DISTANCE_M
    );
  }

  async function send(sample: LocationSample) {
    const backend = deps.backend();
    if (status.state !== 'sharing' || !backend) return;
    const { tripId } = status;
    const gen = generation;
    sending = true;
    try {
      await backend.sendPosition(tripId, sample);
      if (gen !== generation || status.state !== 'sharing') return;
      lastSent = sample;
      set({ ...status, lastSentAt: now(), problem: null });
    } catch (e) {
      if (gen !== generation || status.state !== 'sharing') return;
      const name = e instanceof Error ? e.name : '';
      // Queda en el registro del teléfono (adb logcat) para poder diagnosticar.
      console.warn('[compartir] envío fallido:', name, (e as { reason?: string })?.reason ?? '');
      if (name === 'TripClosedError') {
        // El servidor lo cerró (10 min sin posiciones): solo falta apagar el GPS.
        await finish('timeout', { skipServer: true });
        return;
      }
      const reason = (e as { reason?: string }).reason;
      const problem: SendProblem =
        name !== 'PositionRejectedError'
          ? 'no_signal'
          : reason === 'outside_area' || reason === 'clock'
            ? reason
            : 'rejected';
      if (status.problem !== problem) set({ ...status, problem });
    } finally {
      sending = false;
    }
  }

  async function reportOccupancy(level: Occupancy): Promise<OccupancyReportResult> {
    const backend = deps.backend();
    if (status.state !== 'sharing' || !backend) return { kind: 'not_sharing' };
    const { tripId, routeId } = status;
    if (occupancy.tripId !== tripId) occupancy = { tripId, count: 0, lastAt: 0 };
    const t = now();
    if (occupancy.count >= MAX_OCCUPANCY_REPORTS) return { kind: 'max_reached' };
    if (occupancy.lastAt && t - occupancy.lastAt < OCCUPANCY_INTERVAL_MS) {
      return {
        kind: 'too_soon',
        waitMinutes: Math.max(
          1,
          Math.ceil((OCCUPANCY_INTERVAL_MS - (t - occupancy.lastAt)) / 60_000),
        ),
      };
    }
    try {
      await backend.reportOccupancy(tripId, routeId, level);
      occupancy = { tripId, count: occupancy.count + 1, lastAt: now() };
      return { kind: 'sent' };
    } catch (e) {
      const err = e as { name?: string; reason?: string };
      console.warn('[cupo] reporte fallido:', err.name ?? '', err.reason ?? '');
      if (err.name === 'TripClosedError') {
        await finish('timeout', { skipServer: true });
        return { kind: 'not_sharing' };
      }
      if (err.name === 'OccupancyLimitError') {
        if (err.reason === 'max_reached') return { kind: 'max_reached' };
        // El servidor cuenta desde su último reporte: se asume el intervalo completo.
        occupancy = { ...occupancy, lastAt: now() };
        return { kind: 'too_soon', waitMinutes: 2 };
      }
      return { kind: 'offline' };
    }
  }

  async function finish(
    reason: EndReason,
    opts: { skipServer?: boolean; error?: ShareError } = {},
  ): Promise<void> {
    const current = status;
    if (current.state !== 'sharing' && current.state !== 'starting') return;
    generation++;
    context = null;
    history = [];
    lastSent = null;
    set(
      opts.error
        ? { state: 'error', routeId: current.routeId, error: opts.error }
        : {
            state: 'ended',
            routeId: current.routeId,
            reason,
            sharedMs: current.state === 'sharing' ? now() - current.startedAt : null,
          },
    );
    await deps.tracker.stop().catch(() => {});
    if (current.state === 'sharing' && !opts.skipServer) {
      // Si falla (sin señal), el servidor lo cierra solo a los 10 minutos.
      await deps
        .backend()
        ?.endTrip(current.tripId, reason)
        .catch(() => {});
    }
  }

  return {
    start,
    /** Reintenta el último inicio (tras un error de permiso, GPS o conexión). */
    retry: () => (lastOptions ? start(lastOptions) : Promise.resolve()),
    /** Reporta el cupo (Lleno / Medio / Vacío) en el viaje activo. */
    reportOccupancy,
    /** "Dejar de compartir". */
    stop: () => finish('user'),
    /** Vuelve al estado inicial (al terminar el flujo del viaje). Detiene si seguía. */
    reset: async () => {
      await finish('user');
      set({ state: 'idle' });
    },
    handleSamples,
    getStatus: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
