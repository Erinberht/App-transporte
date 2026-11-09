// Situación mientras esperas el bus: hora de paso (en vivo si hay viajeros compartiendo),
// posible retraso, avisos de los viajeros y, si hace falta, la mejor alternativa.
import type { LiveIncident } from '../api/transit';
import { BLOCKING_KINDS } from '../sharing/incidentText';
import { statusForMargin, type ArrivalStatus, type Plan, type TripOption } from './recommend';

/** Desde cuántos minutos de diferencia con el horario se avisa "posible retraso". */
export const BIG_DELAY_MINUTES = 10;

const MINUTE = 60_000;

export type WaitingSituation = {
  /** Minutos para que el bus pase por tu parada. */
  etaMinutes: number;
  /** true si la hora sale de un bus en vivo (viajeros compartiendo), no del horario. */
  live: boolean;
  boardAt: Date;
  arriveAt: Date;
  marginMinutes: number;
  status: ArrivalStatus;
  /** Minutos que el bus en vivo llega después de lo que dice el horario (si es mucho). */
  delayMinutes: number | null;
  /** Avisos de los viajeros en esta ruta (últimos 30 min). */
  incidents: LiveIncident[];
  /** Mejor otra ruta, solo si en esta hay problemas o llegas tarde. */
  alternative: TripOption | null;
};

/** Rutas con un aviso que las hace poco confiables ahora (varada, desvío). */
export function blockedRoutes(incidents: LiveIncident[]): Set<string> {
  return new Set(incidents.filter((i) => BLOCKING_KINDS.includes(i.kind)).map((i) => i.routeId));
}

/** Mejor opción de otra ruta que llega a tiempo y no tiene avisos graves. */
export function bestAlternative(
  plan: Plan,
  routeId: string,
  incidents: LiveIncident[],
): TripOption | null {
  const blocked = blockedRoutes(incidents);
  for (const o of plan.options) {
    if (o.kind !== 'trip' || o.routeId === routeId || blocked.has(o.routeId)) continue;
    if (o.status !== 'late') return o;
  }
  return null;
}

export function assessWaiting(input: {
  option: TripOption;
  plan: Plan;
  /** Minutos del próximo bus en vivo que alcanzas a tomar (nextLiveArrival), o null. */
  liveEtaMinutes: number | null;
  incidents: LiveIncident[];
  now: number;
}): WaitingSituation {
  const { option, plan, liveEtaMinutes, now } = input;
  const scheduledEta = Math.max(0, Math.round((option.boardAt.getTime() - now) / MINUTE));
  const live = liveEtaMinutes !== null;
  const etaMinutes = live ? liveEtaMinutes : scheduledEta;
  const boardAt = live ? new Date(now + liveEtaMinutes * MINUTE) : option.boardAt;
  const arriveAt = new Date(
    boardAt.getTime() + (option.rideMinutes + option.walkFromStopMinutes) * MINUTE,
  );
  const marginMinutes = Math.floor((plan.arriveBy.getTime() - arriveAt.getTime()) / MINUTE);
  const delay = live ? liveEtaMinutes - scheduledEta : 0;
  const delayMinutes = delay >= BIG_DELAY_MINUTES ? delay : null;
  const incidents = input.incidents.filter((i) => i.routeId === option.routeId);
  const status = statusForMargin(marginMinutes);
  const troubled = incidents.length > 0 || delayMinutes !== null || status === 'late';
  return {
    etaMinutes,
    live,
    boardAt,
    arriveAt,
    marginMinutes,
    status,
    delayMinutes,
    incidents,
    alternative: troubled ? bestAlternative(plan, option.routeId, input.incidents) : null,
  };
}
