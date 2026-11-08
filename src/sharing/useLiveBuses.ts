import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getSupabase } from '../api/supabase';
import { fetchRouteLiveBuses, type LiveBus } from '../api/transit';

export const LIVE_POLL_MS = 15_000;

/**
 * Buses en vivo de una ruta según los viajeros que comparten. Se consulta cada 15 s solo
 * mientras la pantalla está visible. Sin backend (o sin conexión) devuelve una lista vacía.
 */
export function useLiveBuses(routeId: string): LiveBus[] {
  const [buses, setBuses] = useState<LiveBus[]>([]);

  useFocusEffect(
    useCallback(() => {
      const client = getSupabase();
      setBuses([]);
      if (!client) return;
      let cancelled = false;
      const load = () =>
        fetchRouteLiveBuses(client, routeId)
          .then((next) => {
            if (!cancelled) setBuses(next);
          })
          .catch(() => {
            // Sin conexión: se mantiene lo último que se vio.
          });
      load();
      const timer = setInterval(load, LIVE_POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, [routeId]),
  );

  return buses;
}
