// Textos del cupo reportado por los viajeros, ej. "Cupo medio · hace 3 min · 2 viajeros".
import type { OccupancyInfo } from '../api/transit';
import { OCCUPANCY_LABEL } from '../data/live';

function ago(at: Date, now: number): string {
  const minutes = Math.max(0, Math.floor((now - at.getTime()) / 60_000));
  return minutes === 0 ? 'hace menos de 1 min' : `hace ${minutes} min`;
}

export function occupancyText(info: OccupancyInfo | undefined, now: number): string {
  if (!info) return 'Sin reportes de cupo recientes';
  const who = info.reports === 1 ? '1 viajero' : `${info.reports} viajeros`;
  return `Cupo ${OCCUPANCY_LABEL[info.level].toLowerCase()} · ${ago(info.at, now)} · ${who}`;
}
