import type { Occupancy } from '../types';

// Estado EN VIVO de MUESTRA (llegada sin ubicación y avisos). El cupo ya es real
// (src/sharing/useLiveOccupancy.ts); los avisos se reemplazan en la etapa 3.4.
export type LiveStatus = {
  /** Minutos estimados de llegada a la parada del usuario. */
  etaMinutes: number;
  /** Aviso opcional (retrasos, sin reportes, desvíos...). */
  notice?: string;
};

const SAMPLE_LIVE: Record<string, LiveStatus> = {
  '6M': { etaMinutes: 11 },
  AE: { etaMinutes: 18 },
  D1: { etaMinutes: 7 },
  M1: { etaMinutes: 13 },
  P1: { etaMinutes: 9 },
  P2: { etaMinutes: 12 },
  P3: { etaMinutes: 16 },
  RG: { etaMinutes: 15, notice: 'Rancho Grande: sin reportes' },
  S1: { etaMinutes: 8 },
  T2: { etaMinutes: 5 },
};

const UNKNOWN: LiveStatus = { etaMinutes: 10 };

export function getLiveStatus(routeId: string): LiveStatus {
  return SAMPLE_LIVE[routeId] ?? UNKNOWN;
}

/** Primer aviso de una ruta distinta a la elegida (ej. "Rancho Grande: sin reportes"). */
export function noticeForOtherRoute(routeId: string): string | undefined {
  return Object.entries(SAMPLE_LIVE).find(([id, s]) => id !== routeId && s.notice)?.[1].notice;
}

export const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  full: 'Lleno',
  medium: 'Medio',
  empty: 'Vacío',
};
