// Sincronización del catálogo de rutas con el backend, con copia en el teléfono.
//
// 1. Al arrancar (síncrono, antes de mostrar pantallas): si la copia guardada es más nueva que
//    los datos incluidos en la app, se usa esa. Sin red ni backend, la app funciona igual.
// 2. Después (en segundo plano): se descarga el catálogo del backend y se guarda. Se aplica en el
//    siguiente arranque, para no cambiar las rutas mientras el usuario está en una pantalla.
import Storage from 'expo-sqlite/kv-store';

import { fetchTransitDataset } from '../api/transit';
import { getSupabase, type AppSupabaseClient } from '../api/supabase';
import type { TransitDataset } from './model';
import { BUNDLED_DATASET, getActiveDataset, setActiveDataset } from './repository';
import { parseDataset } from './validate';

export const CACHE_KEY = 'transit-dataset:v1';

/** Lo mínimo que se usa del almacenamiento (permite probar con uno en memoria). */
export type KeyValueStorage = {
  getItemSync(key: string): string | null;
  removeItemSync(key: string): unknown;
  setItemAsync(key: string, value: string): Promise<unknown>;
};

const generatedAt = (ds: TransitDataset) => Date.parse(ds.source.generatedAt) || 0;
const isNewer = (a: TransitDataset, b: TransitDataset) => generatedAt(a) > generatedAt(b);

/** Paso 1. Devuelve qué datos quedaron activos. */
export function loadCachedDataset(storage: KeyValueStorage = Storage): 'cache' | 'bundled' {
  try {
    const raw = storage.getItemSync(CACHE_KEY);
    if (raw) {
      const cached = parseDataset(JSON.parse(raw));
      if (isNewer(cached, BUNDLED_DATASET)) {
        setActiveDataset(cached);
        return 'cache';
      }
    }
  } catch {
    // Copia dañada o de un formato anterior: se descarta y se usan los datos incluidos.
    try {
      storage.removeItemSync(CACHE_KEY);
    } catch {}
  }
  setActiveDataset(BUNDLED_DATASET);
  return 'bundled';
}

export type RefreshResult =
  /** Hay datos nuevos guardados; se usan en el próximo arranque. */
  | 'saved'
  | 'unchanged'
  /** Backend sin configurar (.env sin EXPO_PUBLIC_SUPABASE_*). */
  | 'disabled'
  | 'error';

/** Paso 2. Nunca lanza: si falla, la app sigue con lo que tiene. */
export async function refreshDataset(
  client: AppSupabaseClient | null = getSupabase(),
  storage: KeyValueStorage = Storage,
): Promise<RefreshResult> {
  if (!client) return 'disabled';
  try {
    const remote = await fetchTransitDataset(client);
    if (!isNewer(remote, getActiveDataset())) return 'unchanged';
    await storage.setItemAsync(CACHE_KEY, JSON.stringify(remote));
    return 'saved';
  } catch (e) {
    if (__DEV__) console.warn('[rutas] no se pudo actualizar el catálogo:', e);
    return 'error';
  }
}
