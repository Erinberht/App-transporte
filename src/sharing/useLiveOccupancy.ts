import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getSupabase } from '../api/supabase';
import { fetchLiveOccupancy, type LiveOccupancy } from '../api/transit';

export const OCCUPANCY_POLL_MS = 30_000;
const EMPTY: LiveOccupancy = { byRoute: {}, byBus: {} };

/**
 * Cupo reportado por los viajeros en los últimos 10 minutos (todas las rutas y busetas). Se
 * consulta cada 30 s mientras la pantalla está visible. Sin backend devuelve listas vacías.
 */
export function useLiveOccupancy(): LiveOccupancy {
  const [occupancy, setOccupancy] = useState<LiveOccupancy>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      const client = getSupabase();
      if (!client) return;
      let cancelled = false;
      const load = () =>
        fetchLiveOccupancy(client)
          .then((next) => {
            if (!cancelled) setOccupancy(next);
          })
          .catch(() => {
            // Sin conexión: se mantiene lo último que se vio.
          });
      load();
      const timer = setInterval(load, OCCUPANCY_POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, []),
  );

  return occupancy;
}
