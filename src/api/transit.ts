// Llamadas tipadas al backend. Todas reciben el cliente para poder probarlas con uno simulado.
import type { TransitDataset } from '../data/model';
import { parseDataset } from '../data/validate';
import type { Database } from './database.types';
import type { AppSupabaseClient } from './supabase';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Catálogo completo de rutas (no necesita sesión). Lanza ApiError si falla o no es válido. */
export async function fetchTransitDataset(client: AppSupabaseClient): Promise<TransitDataset> {
  const { data, error } = await client.rpc('get_transit_dataset');
  if (error) throw new ApiError('No se pudieron descargar las rutas', error);
  try {
    return parseDataset(data);
  } catch (e) {
    throw new ApiError('El servidor devolvió rutas inválidas', e);
  }
}

export type RouteLiveStatus = {
  activeTrips: number;
  /** Posición agregada del bus según los viajeros (null si nadie compartió en 2 min). */
  position: { latitude: number; longitude: number; at: Date } | null;
  occupancy: {
    level: Database['public']['Enums']['occupancy_level'];
    reports: number;
    at: Date;
  } | null;
};

/** Estado en vivo agregado de una ruta (no necesita sesión). Base de las etapas 3.1 y 3.3. */
export async function fetchRouteLiveStatus(
  client: AppSupabaseClient,
  routeId: string,
): Promise<RouteLiveStatus> {
  const { data, error } = await client.rpc('route_live_status', { p_route_id: routeId });
  if (error) throw new ApiError('No se pudo consultar el estado de la ruta', error);
  // Los campos pueden venir en null aunque los tipos generados digan lo contrario.
  const row = (data?.[0] ?? null) as Partial<
    Record<keyof Database['public']['Functions']['route_live_status']['Returns'][number], unknown>
  > | null;
  const lat = row?.latitude;
  const lng = row?.longitude;
  return {
    activeTrips: typeof row?.active_trips === 'number' ? row.active_trips : 0,
    position:
      typeof lat === 'number' && typeof lng === 'number' && typeof row?.position_at === 'string'
        ? { latitude: lat, longitude: lng, at: new Date(row.position_at) }
        : null,
    occupancy:
      typeof row?.occupancy === 'string' && typeof row.occupancy_at === 'string'
        ? {
            level: row.occupancy as Database['public']['Enums']['occupancy_level'],
            reports: typeof row.occupancy_reports === 'number' ? row.occupancy_reports : 0,
            at: new Date(row.occupancy_at),
          }
        : null,
  };
}

/**
 * Garantiza una sesión anónima (sin nombre, correo ni teléfono) y devuelve su id.
 * Se llama solo cuando hace falta escribir (compartir viaje, reportar cupo), no al abrir la
 * app: así no se crean usuarios para quien solo consulta rutas.
 */
export async function ensureAnonymousSession(client: AppSupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signIn, error } = await client.auth.signInAnonymously();
  if (error || !signIn.user) throw new ApiError('No se pudo iniciar la sesión anónima', error);
  return signIn.user.id;
}

/** "Borrar mis datos" (Ley 1581): elimina el usuario anónimo y todo lo asociado en el servidor. */
export async function deleteMyData(client: AppSupabaseClient): Promise<void> {
  const { data } = await client.auth.getSession();
  if (!data.session) return; // Nunca se creó un usuario: no hay nada que borrar.
  const { error } = await client.rpc('delete_my_data');
  if (error) throw new ApiError('No se pudieron borrar tus datos', error);
  await client.auth.signOut({ scope: 'local' });
}

export type TripEndReason = Database['public']['Enums']['trip_end_reason'];

/** Código de Postgres cuando el viaje no existe, no es tuyo o ya terminó (ver la migración). */
const TRIP_CLOSED = '42501';
/** Código de Postgres cuando la posición no pasa un límite (Montería, hora, frecuencia). */
const CHECK_VIOLATION = '23514';

/** El servidor ya cerró el viaje (por ejemplo, por 10 minutos sin posiciones). */
export class TripClosedError extends ApiError {
  constructor(cause?: unknown) {
    super('El viaje ya terminó en el servidor', cause);
    this.name = 'TripClosedError';
  }
}

/**
 * Empieza un viaje compartido anónimo en una ruta (y, si se escaneó su QR, en un bus) y
 * devuelve su id. Si quedó otro viaje
 * abierto (la app se cerró sin terminarlo), lo cierra antes: solo puede haber uno activo.
 */
export async function startSharedTrip(
  client: AppSupabaseClient,
  routeId: string,
  busId: string | null = null,
): Promise<string> {
  await ensureAnonymousSession(client);
  await client
    .from('shared_trips')
    .update({ ended_at: new Date().toISOString(), ended_reason: 'user' })
    .is('ended_at', null);
  const { data, error } = await client
    .from('shared_trips')
    .insert({ route_id: routeId, bus_id: busId })
    .select('id')
    .single();
  if (error || !data) throw new ApiError('No se pudo empezar a compartir', error);
  return data.id;
}

/** Termina el viaje. Si ya estaba cerrado no pasa nada. */
export async function endSharedTrip(
  client: AppSupabaseClient,
  tripId: string,
  reason: TripEndReason,
): Promise<void> {
  const { error } = await client
    .from('shared_trips')
    .update({ ended_at: new Date().toISOString(), ended_reason: reason })
    .eq('id', tripId)
    .is('ended_at', null);
  if (error) throw new ApiError('No se pudo terminar el viaje', error);
}

export type TripPosition = {
  latitude: number;
  longitude: number;
  recordedAt: Date;
  speedMps: number | null;
  accuracyM: number | null;
};

/** El servidor rechazó la posición (código 23514 de los límites de la migración). */
export class PositionRejectedError extends ApiError {
  constructor(
    readonly reason: 'outside_area' | 'clock' | 'too_frequent' | 'other',
    cause?: unknown,
  ) {
    super('El servidor rechazó la posición', cause);
    this.name = 'PositionRejectedError';
  }
}

function rejectionReason(message: string): PositionRejectedError['reason'] {
  if (/in_monteria|location_check/i.test(message)) return 'outside_area';
  if (/recorded_at/i.test(message)) return 'clock';
  if (/demasiadas posiciones/i.test(message)) return 'too_frequent';
  return 'other';
}

/**
 * Envía una posición del viaje. Lanza TripClosedError si el servidor ya lo cerró y
 * PositionRejectedError si no la acepta (fuera de Montería, hora desfasada...).
 */
export async function sendTripPosition(
  client: AppSupabaseClient,
  tripId: string,
  position: TripPosition,
): Promise<void> {
  const speed = position.speedMps;
  const { error } = await client.from('trip_positions').insert({
    trip_id: tripId,
    recorded_at: position.recordedAt.toISOString(),
    location: `SRID=4326;POINT(${position.longitude} ${position.latitude})`,
    speed_mps: speed !== null && speed >= 0 && speed <= 60 ? speed : null,
    accuracy_m: position.accuracyM !== null && position.accuracyM >= 0 ? position.accuracyM : null,
  });
  if (!error) return;
  if (error.code === TRIP_CLOSED) throw new TripClosedError(error);
  if (error.code === CHECK_VIOLATION) {
    throw new PositionRejectedError(rejectionReason(error.message ?? ''), error);
  }
  throw new ApiError('No se pudo enviar la posición', error);
}

export type LiveBus = {
  latitude: number;
  longitude: number;
  /** Cuántos viajeros comparten desde ese bus. */
  travelers: number;
  at: Date;
};

/** Buses en vivo de una ruta (uno por grupo de viajeros). No necesita sesión. */
export async function fetchRouteLiveBuses(
  client: AppSupabaseClient,
  routeId: string,
): Promise<LiveBus[]> {
  const { data, error } = await client.rpc('route_live_buses', { p_route_id: routeId });
  if (error) throw new ApiError('No se pudo consultar los buses en vivo', error);
  return (data ?? [])
    .filter((b) => typeof b.latitude === 'number' && typeof b.longitude === 'number')
    .map((b) => ({
      latitude: b.latitude,
      longitude: b.longitude,
      travelers: b.travelers,
      at: new Date(b.position_at),
    }));
}

export type BusInfo = { id: string; code: string; routeId: string };

/** Busca una buseta activa por su código (el del QR). null si no existe o está inactiva. */
export async function lookupBus(client: AppSupabaseClient, code: string): Promise<BusInfo | null> {
  const { data, error } = await client
    .from('buses')
    .select('id, code, route_id')
    .eq('code', code)
    .maybeSingle();
  if (error) throw new ApiError('No se pudo validar el bus', error);
  return data ? { id: data.id, code: data.code, routeId: data.route_id } : null;
}
