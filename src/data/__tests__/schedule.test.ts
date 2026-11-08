import type { BusRoute } from '../model';
import { createRoutesRepository } from '../repository';
import { dayTypeOf, departuresOn, nextDepartures } from '../schedule';

const ROUTE: BusRoute = {
  id: 'X1',
  shortName: 'X1',
  longName: 'Prueba',
  operator: 'Metrosinú',
  color: '#123456',
  patterns: [
    {
      id: 'X1-0',
      direction: 0,
      headsign: 'Unicórdoba',
      quality: 'ficticio',
      stops: [
        { stopId: 'a', minutesFromStart: 0 },
        { stopId: 'b', minutesFromStart: 12 },
      ],
      shape: [
        { latitude: 8.75, longitude: -75.88 },
        { latitude: 8.79, longitude: -75.86 },
      ],
    },
  ],
  service: [
    {
      days: 'weekday',
      quality: 'ficticio',
      headways: [
        { from: '05:00', to: '06:00', everyMinutes: 20 },
        { from: '06:00', to: '07:00', everyMinutes: 30 },
        { from: '22:00', to: '23:00', everyMinutes: 30 },
      ],
    },
    {
      days: 'saturday',
      quality: 'ficticio',
      headways: [{ from: '07:00', to: '08:00', everyMinutes: 60 }],
    },
  ],
};

// Lunes 9 de noviembre de 2026, hora local.
const monday = (h: number, m = 0) => new Date(2026, 10, 9, h, m);
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (dates: Date[]) =>
  dates.map((d) => `${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`);

describe('dayTypeOf', () => {
  it('distingue entre semana, sábado y domingo', () => {
    expect(dayTypeOf(monday(8))).toBe('weekday');
    expect(dayTypeOf(new Date(2026, 10, 14))).toBe('saturday');
    expect(dayTypeOf(new Date(2026, 10, 15))).toBe('sunday_holiday');
  });

  it('un festivo opera como domingo', () => {
    // 16 de noviembre de 2026: festivo de la Independencia de Cartagena (trasladado a lunes).
    const holiday = new Date(2026, 10, 16, 8);
    expect(dayTypeOf(holiday, { isHoliday: (d) => d.getDate() === 16 })).toBe('sunday_holiday');
  });
});

describe('departuresOn', () => {
  it('genera las salidas de cada franja sin incluir el fin', () => {
    expect(hhmm(departuresOn(ROUTE, monday(12)))).toEqual([
      '9 05:00',
      '9 05:20',
      '9 05:40',
      '9 06:00',
      '9 06:30',
      '9 22:00',
      '9 22:30',
    ]);
  });

  it('sin horario para ese día no hay salidas (domingo)', () => {
    expect(departuresOn(ROUTE, new Date(2026, 10, 15))).toEqual([]);
  });
});

describe('nextDepartures', () => {
  it('incluye una salida exactamente a la hora pedida', () => {
    expect(hhmm(nextDepartures(ROUTE, monday(5, 20), 2))).toEqual(['9 05:20', '9 05:40']);
  });

  it('salta la pausa del mediodía', () => {
    expect(hhmm(nextDepartures(ROUTE, monday(6, 31), 2))).toEqual(['9 22:00', '9 22:30']);
  });

  it('suma el tiempo hasta la parada', () => {
    expect(hhmm(nextDepartures(ROUTE, monday(5, 0), 2, 12))).toEqual(['9 05:12', '9 05:32']);
  });

  it('después del último bus sigue al día siguiente', () => {
    expect(hhmm(nextDepartures(ROUTE, monday(23, 0), 2))).toEqual(['10 05:00', '10 05:20']);
  });

  it('el sábado después del último bus salta el domingo sin servicio', () => {
    expect(hhmm(nextDepartures(ROUTE, new Date(2026, 10, 14, 9), 1))).toEqual(['16 05:00']);
  });

  it('sin servicio en los próximos días no devuelve salidas', () => {
    expect(nextDepartures({ ...ROUTE, service: [] }, monday(8), 3)).toEqual([]);
  });
});

describe('repositorio', () => {
  const repo = createRoutesRepository({
    schemaVersion: 1,
    source: { kind: 'seed', description: 'prueba', generatedAt: '2026-11-08T00:00:00Z' },
    stops: [
      { id: 'a', name: 'A', coordinate: { latitude: 8.75, longitude: -75.88 } },
      { id: 'b', name: 'B', coordinate: { latitude: 8.79, longitude: -75.86 } },
    ],
    routes: [ROUTE],
  });

  it('busca rutas, recorridos y paradas', () => {
    expect(repo.listRoutes()).toHaveLength(1);
    expect(repo.getRoute('X1')?.longName).toBe('Prueba');
    expect(repo.getRoute('nada')).toBeUndefined();
    expect(repo.getPattern('X1', 1)).toBeUndefined();
    expect(repo.getPatternStops('X1').map((s) => [s.name, s.minutesFromStart])).toEqual([
      ['A', 0],
      ['B', 12],
    ]);
  });

  it('encuentra la parada más cercana y las rutas cercanas', () => {
    expect(repo.nearestPatternStop('X1', { latitude: 8.788, longitude: -75.861 })?.id).toBe('b');
    expect(repo.routesNear({ latitude: 8.7501, longitude: -75.88 }, 50)).toHaveLength(1);
    expect(repo.routesNear({ latitude: 8.77, longitude: -75.87 }, 50)).toHaveLength(0);
  });

  it('calcula los pasos por una parada', () => {
    const atB = repo.nextDepartures('X1', monday(5, 10), { count: 1, stopId: 'b' });
    expect(hhmm(atB)).toEqual(['9 05:12']);
    expect(repo.nextDepartures('X1', monday(5), { stopId: 'zz' })).toEqual([]);
    expect(repo.nextDepartures('nada', monday(5))).toEqual([]);
  });
});
