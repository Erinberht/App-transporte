// Instancia de la app: GPS real (expo-location) + Supabase.
import { useSyncExternalStore } from 'react';

import { getSupabase } from '../api/supabase';
import { endSharedTrip, sendTripPosition, startSharedTrip } from '../api/transit';
import { expoTracker } from './expoTracker';
import { createShareSession, type ShareBackend, type ShareStatus } from './shareSession';

function supabaseBackend(): ShareBackend | null {
  const client = getSupabase();
  if (!client) return null;
  return {
    startTrip: (routeId, busId) => startSharedTrip(client, routeId, busId),
    endTrip: (tripId, reason) => endSharedTrip(client, tripId, reason),
    sendPosition: (tripId, s) =>
      sendTripPosition(client, tripId, {
        latitude: s.coordinate.latitude,
        longitude: s.coordinate.longitude,
        recordedAt: new Date(s.timestamp),
        speedMps: s.speedMps,
        accuracyM: s.accuracy,
      }),
  };
}

export const liveShare = createShareSession({ backend: supabaseBackend, tracker: expoTracker });

export function useShareStatus(): ShareStatus {
  return useSyncExternalStore(liveShare.subscribe, liveShare.getStatus);
}
