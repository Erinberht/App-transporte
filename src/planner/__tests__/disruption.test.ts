import type { LiveIncident } from '../../api/transit';
import type { LatLng } from '../../data/geo';
import type { PatternStopInfo } from '../../data/repository';
import { detectStuck, type LocationSample } from '../../sharing/alighting';
import { incidentText } from '../../sharing/incidentText';
import { assessWaiting, bestAlternative, BIG_DELAY_MINUTES } from '../disruption';
import { minutesAlong, nextLiveArrival } from '../liveEta';
import type { Plan, TripOption } from '../recommend';

// Recorrido recto de oeste a este, ~2,2 km, con 3 paradas a 0, 5 y 10 minutos.
const PATH: LatLng[] = [
  { latitude: 8.75, longitude: -75.89 },
  { latitude: 8.75, longitude: -75.87 },
];
const at = (fraction: number): LatLng => ({ latitude: 8.75, longitude: -75.89 + 0.02 * fraction });
const stop = (id: string, fraction: number, minutes: number): PatternStopInfo => ({
  id,
  name: id.toUpperCase(),
  coordinate: at(fraction),
  minutesFromStart: minutes,
});
const STOPS = [stop('a', 0, 0), stop('b', 0.5, 5), stop('c', 1, 10)];

describe('hora de llegada en vivo', () => {
  it('interpola los minutos del recorrido entre paradas', () => {
    expect(minutesAlong(PATH, STOPS, at(0.25))).toBeCloseTo(2.5, 1);
    expect(minutesAlong(PATH, STOPS, at(0.75))).toBeCloseTo(7.5, 1);
  });

  it('el bus más cercano que aún no pasa por tu parada', () => {
    // Paradas: subes en "c" (min 10). Buses en 0.2 (min 2) y 0.6 (min 6).
    expect(nextLiveArrival([at(0.2), at(0.6)], PATH, STOPS, STOPS[2])).toBe(4);
  });

  it('ignora buses que ya pasaron, que no alcanzas o que van lejos del recorrido', () => {
    expect(nextLiveArrival([at(0.8)], PATH, STOPS, STOPS[1])).toBeNull(); // ya pasó "b"
    expect(nextLiveArrival([at(0.4)], PATH, STOPS, STOPS[2], 7)).toBeNull(); // llega en 6, caminas 7
    const far = { latitude: 8.76, longitude: -75.88 }; // ~1 km al norte
    expect(nextLiveArrival([far], PATH, STOPS, STOPS[2])).toBeNull();
  });
});

describe('detectStuck', () => {
  const T0 = 1_800_000_000_000;
  const trip = { path: PATH, alightStop: at(1), startedAt: T0 };
  const samples = (where: LatLng, speed: number, minutes = 5) => {
    const out: LocationSample[] = [];
    for (let t = 0; t <= minutes * 60_000; t += 10_000) {
      out.push({ timestamp: T0 + t, coordinate: where, speedMps: speed, accuracy: 10 });
    }
    return out;
  };

  it('5 minutos quieto sobre el recorrido: pregunta si se varó', () => {
    expect(detectStuck(samples(at(0.4), 0), trip, T0 + 300_000)).toBe(true);
  });

  it('en movimiento, por poco tiempo o junto a la parada de bajada: no', () => {
    expect(detectStuck(samples(at(0.4), 6), trip, T0 + 300_000)).toBe(false);
    expect(detectStuck(samples(at(0.4), 0, 3), trip, T0 + 180_000)).toBe(false);
    expect(detectStuck(samples(at(0.99), 0), trip, T0 + 300_000)).toBe(false);
  });
});

// Plan de prueba: dos opciones, la ruta X (la elegida) y la Y.
const option = (routeId: string, boardAt: Date, margin: number): TripOption => ({
  kind: 'trip',
  routeId,
  boardStop: STOPS[0],
  alightStop: STOPS[2],
  walkToStopMinutes: 3,
  rideMinutes: 10,
  walkFromStopMinutes: 2,
  leaveAt: new Date(boardAt.getTime() - 3 * 60_000),
  boardAt,
  arriveAt: new Date(boardAt.getTime() + 12 * 60_000),
  marginMinutes: margin,
  status: margin < 0 ? 'late' : margin >= 5 ? 'early' : 'just',
});
const NOW = new Date(2026, 10, 9, 6, 30).getTime();
const ARRIVE_BY = new Date(2026, 10, 9, 7, 0);
const X = option('X', new Date(NOW + 5 * 60_000), 13); // pasa en 5, llega 6:47
const Y = option('Y', new Date(NOW + 8 * 60_000), 10);
const PLAN: Plan = { arriveBy: ARRIVE_BY, options: [X, Y] };
const incident = (routeId: string, kind: LiveIncident['kind']): LiveIncident => ({
  routeId,
  kind,
  reports: 2,
  at: new Date(NOW - 4 * 60_000),
  location: null,
  nearStop: 'Calle 22',
});

describe('assessWaiting', () => {
  it('sin problemas: usa el horario y no sugiere alternativa', () => {
    const w = assessWaiting({
      option: X,
      plan: PLAN,
      liveEtaMinutes: null,
      incidents: [],
      now: NOW,
    });
    expect(w).toMatchObject({ etaMinutes: 5, live: false, delayMinutes: null, alternative: null });
    expect(w.status).toBe('early');
  });

  it('con un bus en vivo recalcula la llegada; si va muy tarde avisa y sugiere otra ruta', () => {
    const w = assessWaiting({
      option: X,
      plan: PLAN,
      liveEtaMinutes: 5 + BIG_DELAY_MINUTES + 2,
      incidents: [],
      now: NOW,
    });
    expect(w).toMatchObject({ etaMinutes: 17, live: true, delayMinutes: 12 });
    // Pasa 6:47, llega 6:59: justo.
    expect(w.marginMinutes).toBe(1);
    expect(w.alternative?.routeId).toBe('Y');
  });

  it('si reportan que la buseta se varó, avisa y sugiere otra ruta', () => {
    const w = assessWaiting({
      option: X,
      plan: PLAN,
      liveEtaMinutes: null,
      incidents: [incident('X', 'broken_down'), incident('Z', 'detour')],
      now: NOW,
    });
    expect(w.incidents.map((i) => i.kind)).toEqual(['broken_down']);
    expect(w.alternative?.routeId).toBe('Y');
  });

  it('la alternativa no puede ser una ruta varada ni una que llega tarde', () => {
    expect(bestAlternative(PLAN, 'X', [incident('Y', 'broken_down')])).toBeNull();
    const lateY = { ...Y, status: 'late' as const, marginMinutes: -3 };
    expect(bestAlternative({ ...PLAN, options: [X, lateY] }, 'X', [])).toBeNull();
    // Un retraso reportado en Y no la descarta (sigue pasando).
    expect(bestAlternative(PLAN, 'X', [incident('Y', 'big_delay')])?.routeId).toBe('Y');
  });
});

describe('incidentText', () => {
  it('qué pasó, dónde, hace cuánto y cuántos lo reportan', () => {
    expect(incidentText(incident('P3', 'broken_down'), 'P3', NOW)).toBe(
      'La P3 se varó cerca de Calle 22 · hace 4 min · 2 viajeros reportan',
    );
    expect(
      incidentText({ ...incident('P3', 'detour'), reports: 1, nearStop: null }, 'P3', NOW),
    ).toBe('La P3 cambió de ruta o se desvió · hace 4 min · 1 viajero reporta');
  });
});
