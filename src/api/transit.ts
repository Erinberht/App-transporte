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
