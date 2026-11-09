import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getSupabase } from '../api/supabase';
import { fetchLiveIncidents, type LiveIncident } from '../api/transit';

export const INCIDENTS_POLL_MS = 30_000;

/**
 * Avisos de los viajeros de los últimos 30 minutos (busetas varadas, desvíos, retrasos). Se
 * consulta cada 30 s mientras la pantalla está visible. Sin backend devuelve una lista vacía.
 */
export function useLiveIncidents(): LiveIncident[] {
  const [incidents, setIncidents] = useState<LiveIncident[]>([]);

  useFocusEffect(
    useCallback(() => {
      const client = getSupabase();
      if (!client) return;
      let cancelled = false;
      const load = () =>
        fetchLiveIncidents(client)
          .then((next) => {
            if (!cancelled) setIncidents(next);
          })
          .catch(() => {
            // Sin conexión: se mantiene lo último que se vio.
          });
      load();
      const timer = setInterval(load, INCIDENTS_POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, []),
  );

  return incidents;
}
