// Instancia de la app: GPS real (expo-location) + Supabase.
import { useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import { getSupabase } from '../api/supabase';
import {
  endSharedTrip,
  reportIncident,
  reportOccupancy,
  sendTripPosition,
  startSharedTrip,
} from '../api/transit';
import { expoTracker } from './expoTracker';
import { createShareSession, type ShareBackend, type ShareStatus } from './shareSession';

// Control de Anti-abuso
const MIN_REPORT_INTERVAL_MS = 60 * 1000; // 1 minuto
let lastReportTime = 0;

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - lastReportTime < MIN_REPORT_INTERVAL_MS) {
    Alert.alert(
      'Espera un momento',
      'Has enviado un reporte hace poco. Por favor espera para no saturar el sistema.',
    );
    return false;
  }
  lastReportTime = now;
  return true;
}

function supabaseBackend(): ShareBackend | null {
  const client = getSupabase();
  if (!client) return null;
  return {
    startTrip: (routeId, busId) => startSharedTrip(client, routeId, busId),
    endTrip: (tripId, reason) => endSharedTrip(client, tripId, reason),
    reportOccupancy: (tripId, routeId, level) => {
      if (!checkRateLimit()) return Promise.resolve();
      return reportOccupancy(client, tripId, routeId, level);
    },
    reportIncident: (tripId, routeId, kind) => {
      if (!checkRateLimit()) return Promise.resolve();
      return reportIncident(client, tripId, routeId, kind);
    },
    sendPosition: (tripId, s) => {
      // Regla de Anti-Abuso Simple: Ignorar reportes que tengan baja precisión del GPS.
      if (s.accuracy && s.accuracy > 100) return Promise.resolve();

      return sendTripPosition(client, tripId, {
        latitude: s.coordinate.latitude,
        longitude: s.coordinate.longitude,
        recordedAt: new Date(s.timestamp),
        speedMps: s.speedMps,
        accuracyM: s.accuracy,
      });
    },
  };
}

export const liveShare = createShareSession({ backend: supabaseBackend, tracker: expoTracker });

export function useShareStatus(): ShareStatus {
  return useSyncExternalStore(liveShare.subscribe, liveShare.getStatus);
}
