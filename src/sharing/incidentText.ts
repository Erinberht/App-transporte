// Textos de los avisos que reportan los viajeros (etapa 3.4).
import type { IncidentKind, LiveIncident } from '../api/transit';

export const INCIDENT_LABEL: Record<IncidentKind, string> = {
  broken_down: 'Se varó',
  detour: 'Cambió de ruta o se desvió',
  big_delay: 'Va muy retrasada',
};

const VERB: Record<IncidentKind, string> = {
  broken_down: 'se varó',
  detour: 'cambió de ruta o se desvió',
  big_delay: 'va muy retrasada',
};

/** Los incidentes que hacen que una ruta no sea confiable ahora (no solo lenta). */
export const BLOCKING_KINDS: IncidentKind[] = ['broken_down', 'detour'];

/** "La P3 se varó cerca de Calle 22 · hace 4 min · 2 viajeros reportan". */
export function incidentText(incident: LiveIncident, routeName: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - incident.at.getTime()) / 60_000));
  const ago = minutes === 0 ? 'hace menos de 1 min' : `hace ${minutes} min`;
  const where = incident.nearStop ? ` cerca de ${incident.nearStop}` : '';
  const who =
    incident.reports === 1 ? '1 viajero reporta' : `${incident.reports} viajeros reportan`;
  return `La ${routeName} ${VERB[incident.kind]}${where} · ${ago} · ${who}`;
}
