import { createRoutesRepository } from '../../data/repository';
import type { BusRoute, Stop, TransitDataset } from '../../data/model';
import { servedByAnyRoute } from '../coverage';
import {
  arrivalLabel,
  noRouteNotice,
  recommendRoutes,
  resolveArriveBy,
  statusForMargin,
  unavailableLabel,
  walkMinutes,
  type PlanInput,
  type TripOption,
  type UnavailableOption,
} from '../recommend';

// Catálogo de prueba: paradas en una línea norte-sur hasta la universidad (U).
const STOPS: Stop[] = [
  { id: 's0', name: 'S0', coordinate: { latitude: 8.74, longitude: -75.87 } },
  { id: 's1', name: 'S1', coordinate: { latitude: 8.75, longitude: -75.87 } },
  { id: 's2', name: 'S2', coordinate: { latitude: 8.76, longitude: -75.87 } },
  { id: 's3', name: 'S3', coordinate: { latitude: 8.77, longitude: -75.87 } },
  { id: 'u', name: 'U', coordinate: { latitude: 8.79, longitude: -75.86 } },
  { id: 'far', name: 'Lejos', coordinate: { latitude: 8.66, longitude: -75.95 } },
];
const DESTINATION = { latitude: 8.7905, longitude: -75.859 };
const AT = (id: string) => STOPS.find((s) => s.id === id)!.coordinate;

function route(
  id: string,
  stops: [string, number][],
  headways: { from: string; to: string; everyMinutes: number }[],
): BusRoute {
  return {
    id,
    shortName: id,
    longName: `Ruta ${id}`,
    operator: 'Prueba',
    color: '#123456',
    patterns: [
      {
        id: `${id}-0`,
        direction: 0,
        headsign: 'U',
        quality: 'ficticio',
        stops: stops.map(([stopId, minutesFromStart]) => ({ stopId, minutesFromStart })),
        shape: stops.map(([stopId]) => AT(stopId)),
      },
    ],
    service: [{ days: 'weekday', quality: 'ficticio', headways }],
  };
}

const DATASET: TransitDataset = {
  schemaVersion: 1,
  source: { kind: 'seed', description: 'prueba', generatedAt: '2026-11-08T00:00:00Z' },
  stops: STOPS,
  routes: [
    // A: cada 10 min de 5:00 a 22:00. Pasa por S1 a los :04, :14, :24...
    route(
      'A',
      [
        ['s0', 0],
        ['s1', 4],
        ['s2', 8],
        ['u', 16],
      ],
      [{ from: '05:00', to: '22:00', everyMinutes: 10 }],
    ),
    // B: cada 20 min, solo de 6:00 a 9:00.
    route(
      'B',
      [
        ['s1', 0],
        ['s3', 6],
        ['u', 10],
      ],
      [{ from: '06:00', to: '09:00', everyMinutes: 20 }],
    ),
    // C: va al revés (sale de la U): no sirve para llegar.
    route(
      'C',
      [
        ['u', 0],
        ['s2', 8],
      ],
      [{ from: '05:00', to: '22:00', everyMinutes: 10 }],
    ),
    // D: sale de muy lejos.
    route(
      'D',
      [
        ['far', 0],
        ['u', 30],
      ],
      [{ from: '05:00', to: '22:00', everyMinutes: 10 }],
    ),
  ],
};
const repo = createRoutesRepository(DATASET);

// Lunes 9 de noviembre de 2026.
const at = (h: number, m = 0, day = 9) => new Date(2026, 10, day, h, m);
const hhmm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

function plan(overrides: Partial<PlanInput> = {}) {
  return recommendRoutes({
    repo,
    origin: AT('s1'),
    destination: DESTINATION,
    now: at(6, 30),
    arriveBy: at(7, 0),
    ...overrides,
  });
}
const trip = (p: ReturnType<typeof plan>, id: string) =>
  p.options.find((o) => o.routeId === id) as TripOption;
const unavailable = (p: ReturnType<typeof plan>, id: string) =>
  p.options.find((o) => o.routeId === id) as UnavailableOption;

describe('walkMinutes', () => {
  it('1 km en línea recta ≈ 1,3 km por calles a 4,5 km/h = 18 min', () => {
    const a = { latitude: 8.75, longitude: -75.87 };
    const b = { latitude: 8.75 + 1 / 111.2, longitude: -75.87 }; // ~1 km al norte
    expect(walkMinutes(a, b)).toBe(18);
  });

  it('ritmo lento (como en Moovit) duplica el tiempo', () => {
    const a = { latitude: 8.75, longitude: -75.87 };
    const b = { latitude: 8.75 + 1 / 111.2, longitude: -75.87 };
    expect(walkMinutes(a, b, { pace: 'slow', maxWalkMinutes: null })).toBe(35);
  });

  it('mismo punto = 0 min', () => {
    expect(walkMinutes(AT('s1'), AT('s1'))).toBe(0);
  });
});

describe('resolveArriveBy', () => {
  it('clase más tarde hoy', () => {
    expect(resolveArriveBy({ hours: 7, minutes: 0 }, at(6, 0))).toEqual(at(7, 0));
  });

  it('clase que empezó hace poco sigue siendo la de hoy (llegas tarde)', () => {
    expect(resolveArriveBy({ hours: 7, minutes: 0 }, at(7, 30))).toEqual(at(7, 0));
  });

  it('de noche, la clase de las 7 es la de mañana', () => {
    expect(resolveArriveBy({ hours: 7, minutes: 0 }, at(20, 0))).toEqual(at(7, 0, 10));
  });
});

describe('recommendRoutes', () => {
  it('calcula caminata, espera, trayecto y caminata final', () => {
    const a = trip(plan(), 'A');
    // En S1 a las 6:30 → bus de las 6:34 → 12 min hasta U → 3 min al campus.
    expect(a.boardStop.id).toBe('s1');
    expect(a.walkToStopMinutes).toBe(0);
    expect(hhmm(a.boardAt)).toBe('6:34');
    expect(a.rideMinutes).toBe(12);
    expect(a.walkFromStopMinutes).toBe(3);
    expect(hhmm(a.arriveAt)).toBe('6:49');
    expect(a.marginMinutes).toBe(11);
    expect(arrivalLabel(a)).toBe('Llegas 11 min antes');
  });

  it('ordena por margen: primero la que llega con más tiempo', () => {
    const p = plan();
    // B pasa por S1 a las 6:40 y llega a las 6:53 (7 min antes); A llega a las 6:49.
    expect(trip(p, 'B').marginMinutes).toBe(7);
    // D llega tarde (va antes que las no disponibles); C no sirve.
    expect(p.options.map((o) => o.routeId)).toEqual(['A', 'B', 'D', 'C']);
  });

  it('una ruta que va al revés no sirve', () => {
    expect(unavailable(plan(), 'C').reason).toBe('no_path');
    expect(unavailableLabel(unavailable(plan(), 'C'))).toBe('No te sirve para este viaje');
  });

  it('sin límite de caminata (por defecto) también propone rutas lejanas', () => {
    const d = trip(plan(), 'D');
    expect(d.kind).toBe('trip');
    expect(d.walkToStopMinutes).toBeGreaterThan(100);
    expect(d.status).toBe('late');
  });

  it('con límite de caminata (2 a 16 min) descarta las paradas lejanas', () => {
    const p = plan({ walking: { pace: 'normal', maxWalkMinutes: 10 } });
    const d = unavailable(p, 'D');
    expect(d.reason).toBe('walk_limit');
    expect(unavailableLabel(d)).toMatch(/^Caminata de \d+ min \(supera tu límite\)$/);
    expect(p.options[p.options.length - 1].routeId).toBe('D');
  });

  it('elige entre varias paradas la que hace llegar antes', () => {
    // Entre S0 y S1: puede caminar a S1 (~9 min) o a S0 (~9 min) — gana la de llegada más temprana.
    const between = { latitude: 8.745, longitude: -75.87 };
    const a = trip(plan({ origin: between }), 'A');
    const alternatives = ['s0', 's1'].map((id) => {
      const walk = walkMinutes(between, AT(id));
      const [bus] = repo.nextDepartures('A', new Date(at(6, 30).getTime() + walk * 60_000), {
        stopId: id,
        count: 1,
      });
      return bus.getTime();
    });
    expect(a.boardAt.getTime()).toBe(Math.min(...alternatives));
  });

  it('margen exactamente 0 = "Llegas justo"', () => {
    const a = trip(plan({ arriveBy: at(6, 49) }), 'A');
    expect(a.marginMinutes).toBe(0);
    expect(arrivalLabel(a)).toBe('Llegas justo');
  });

  it('si llega tarde lo dice con los minutos', () => {
    const a = trip(plan({ arriveBy: at(6, 40) }), 'A');
    expect(a.marginMinutes).toBe(-9);
    expect(arrivalLabel(a)).toBe('Llegas tarde · 9 min');
  });

  it('las que llegan tarde van después de las que llegan a tiempo', () => {
    // Clase 6:51: A llega 6:49 (a tiempo), B llega 6:53 (tarde).
    const p = plan({ arriveBy: at(6, 51) });
    expect(p.options.slice(0, 2).map((o) => [o.routeId, (o as TripOption).status])).toEqual([
      ['A', 'just'],
      ['B', 'late'],
    ]);
  });

  it('fuera de horario: "No opera a esta hora"', () => {
    const p = plan({ now: at(23, 0), arriveBy: at(7, 0, 10) });
    expect(unavailable(p, 'A').reason).toBe('no_service');
    expect(unavailableLabel(unavailable(p, 'A'))).toBe('No opera a esta hora');
  });

  it('B fuera de su franja (después de las 9) no opera', () => {
    expect(unavailable(plan({ now: at(9, 30), arriveBy: at(10, 0) }), 'B').reason).toBe(
      'no_service',
    );
  });

  it('con mucha anticipación sugiere la última salida con 10 min de colchón', () => {
    const a = trip(plan({ now: at(5, 0), arriveBy: at(8, 0) }), 'A');
    // Debe llegar a más tardar 7:50: bus en S1 a las 7:34 → llega 7:49.
    expect(hhmm(a.latestLeaveAt!)).toBe('7:34');
    expect(trip(plan(), 'A').latestLeaveAt).toBeUndefined(); // faltan solo 30 min
  });

  it('muy cerca del campus sugiere caminar', () => {
    const near = { latitude: 8.7895, longitude: -75.859 };
    expect(plan({ origin: near }).walkInstead?.minutes).toBeLessThanOrEqual(8);
    expect(plan().walkInstead).toBeUndefined();
  });

  it('statusForMargin', () => {
    expect(statusForMargin(-1)).toBe('late');
    expect(statusForMargin(0)).toBe('just');
    expect(statusForMargin(4)).toBe('just');
    expect(statusForMargin(5)).toBe('early');
  });
});

describe('otros destinos (lugares del perfil)', () => {
  // Unos 2 km al occidente de S1: ninguna parada queda a menos de 1,2 km.
  const lejos = { latitude: 8.75, longitude: -75.89 };
  // A 300 m de S2: A sirve (S1 → S2); B no pasa por S2.
  const cercaS2 = { latitude: 8.7627, longitude: -75.87 };

  it('si ninguna parada queda cerca del destino, ninguna ruta sirve y se avisa', () => {
    const p = plan({ origin: AT('s0'), destination: lejos });
    expect(p.options.every((o) => o.kind === 'unavailable' && o.reason === 'no_path')).toBe(true);
    expect(noRouteNotice(p, 'Casa')).toBe('Ninguna de las rutas cargadas llega cerca de Casa.');
  });

  it('sirve para un destino que no es la universidad', () => {
    const p = plan({ origin: AT('s0'), destination: cercaS2 });
    const a = trip(p, 'A');
    expect(a.alightStop.id).toBe('s2');
    expect(noRouteNotice(p, 'Trabajo')).toBeNull();
  });

  it('sin rutas a esta hora el aviso no dice que no llegan', () => {
    const p = plan({ now: at(23, 0), arriveBy: at(23, 30) });
    expect(noRouteNotice(p, 'Universidad de Córdoba')).toBe(
      'Ninguna ruta te sirve ahora para llegar a Universidad de Córdoba.',
    );
  });

  it('con límite de caminata sugiere subirlo', () => {
    // A ~1 km de cualquier parada, con máximo 2 min a pie.
    const origin = { latitude: 8.745, longitude: -75.88 };
    const p = plan({ origin, walking: { pace: 'normal', maxWalkMinutes: 2 } });
    expect(p.options.some((o) => o.kind === 'trip')).toBe(false);
    expect(noRouteNotice(p, 'Casa')).toBe(
      'Ninguna ruta te sirve ahora para llegar a Casa. Prueba con un límite de caminata mayor en tu perfil.',
    );
  });

  it('servedByAnyRoute', () => {
    expect(servedByAnyRoute(cercaS2, repo)).toBe(true);
    expect(servedByAnyRoute(lejos, repo)).toBe(false);
  });
});
