import type { Occupancy } from '../types';

// Hora de llegada de MUESTRA, solo para cuando no hay ubicación (sin parada de subida no se
// puede calcular). El cupo y los avisos ya son reales (src/sharing).
export type LiveStatus = {
  /** Minutos estimados de llegada a la parada del usuario. */
  etaMinutes: number;
};

const SAMPLE_LIVE: Record<string, LiveStatus> = {
  '6M': { etaMinutes: 11 },
  AE: { etaMinutes: 18 },
  D1: { etaMinutes: 7 },
  M1: { etaMinutes: 13 },
  P1: { etaMinutes: 9 },
  P2: { etaMinutes: 12 },
  P3: { etaMinutes: 16 },
  RG: { etaMinutes: 15 },
  S1: { etaMinutes: 8 },
  T2: { etaMinutes: 5 },
};

const UNKNOWN: LiveStatus = { etaMinutes: 10 };

export function getLiveStatus(routeId: string): LiveStatus {
  return SAMPLE_LIVE[routeId] ?? UNKNOWN;
}

export const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  full: 'Lleno',
  medium: 'Medio',
  empty: 'Vacío',
};
