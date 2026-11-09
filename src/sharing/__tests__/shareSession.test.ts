import type { LatLng } from '../../data/geo';
import type { LocationSample } from '../alighting';
import { shareMessage } from '../messages';
import {
  createShareSession,
  type LocationMode,
  MAX_OCCUPANCY_REPORTS,
  type LocationTracker,
  type ShareBackend,
  type StartOptions,
} from '../shareSession';

const PATH: LatLng[] = [
  { latitude: 8.75, longitude: -75.89 },
  { latitude: 8.75, longitude: -75.87 },
];
const OPTIONS: StartOptions = {
  routeId: 'P3',
  label: 'Ruta P3',
  path: PATH,
  alightStop: PATH[1],
};
const T0 = 1_800_000_000_000;

/** Punto sobre la calle del recorrido, `m` metros al este del inicio. */
const onRoute = (m: number): LatLng => ({
  latitude: 8.75,
  longitude: -75.89 + m / (111_195 * Math.cos((8.75 * Math.PI) / 180)),
});

function setup(permission: LocationMode | 'denied' | 'services_off' = 'background') {
  let clock = T0;
  let onSamples: ((s: LocationSample[]) => void) | null = null;
  const tracker = {
    requestPermission: jest.fn(async () => permission),
    start: jest.fn(async (_mode: LocationMode, _label: string, cb) => {
      onSamples = cb;
    }),
    stop: jest.fn(async () => {
      onSamples = null;
    }),
  } satisfies LocationTracker;
  const backend = {
    startTrip: jest.fn(async () => 'trip-1'),
    endTrip: jest.fn(async () => {}),
    sendPosition: jest.fn(async () => {}),
    reportOccupancy: jest.fn(async () => {}),
    reportIncident: jest.fn(async () => {}),
  } satisfies ShareBackend;
  let hasBackend = true;
  const session = createShareSession({
    backend: () => (hasBackend ? backend : null),
    tracker,
    now: () => clock,
  });

  /** Avanza el reloj y entrega una lectura del GPS. */
  async function gps(atMs: number, coordinate: LatLng, speedMps = 8, accuracy = 10) {
    clock = T0 + atMs;
    onSamples?.([{ timestamp: clock, coordinate, speedMps, accuracy }]);
    await Promise.resolve();
    await Promise.resolve();
  }

  return {
    session,
    tracker,
    backend,
    gps,
    withoutBackend: () => (hasBackend = false),
    get clock() {
      return clock;
    },
  };
}

describe('createShareSession', () => {
  it('pide permiso, crea el viaje anónimo y empieza el GPS en segundo plano', async () => {
    const { session, tracker, backend } = setup('background');
    await session.start(OPTIONS);

    expect(tracker.requestPermission).toHaveBeenCalled();
    expect(backend.startTrip).toHaveBeenCalledWith('P3', null);
    expect(tracker.start).toHaveBeenCalledWith('background', 'Ruta P3', expect.any(Function));
    expect(session.getStatus()).toMatchObject({
      state: 'sharing',
      tripId: 'trip-1',
      mode: 'background',
      lastSentAt: null,
    });
  });

  it('envía la primera posición enseguida y luego como mucho cada 10 s si se movió 25 m', async () => {
    const { session, backend, gps } = setup();
    await session.start(OPTIONS);

    await gps(0, onRoute(0));
    expect(backend.sendPosition).toHaveBeenCalledTimes(1);
    expect(session.getStatus()).toMatchObject({ lastSentAt: T0 });

    await gps(5_000, onRoute(60)); // muy pronto
    expect(backend.sendPosition).toHaveBeenCalledTimes(1);

    await gps(12_000, onRoute(70)); // ya pasaron 10 s y se movió 70 m
    expect(backend.sendPosition).toHaveBeenCalledTimes(2);

    await gps(30_000, onRoute(80)); // solo 10 m más: no vale la pena
    expect(backend.sendPosition).toHaveBeenCalledTimes(2);
  });

  it('en un trancón (quieto) igual envía una vez por minuto para no desaparecer del mapa', async () => {
    const { session, backend, gps } = setup();
    await session.start(OPTIONS);
    await gps(0, onRoute(100), 0);
    await gps(30_000, onRoute(100), 0);
    expect(backend.sendPosition).toHaveBeenCalledTimes(1);
    await gps(61_000, onRoute(100), 0);
    expect(backend.sendPosition).toHaveBeenCalledTimes(2);
  });

  it('no envía lecturas imprecisas', async () => {
    const { session, backend, gps } = setup();
    await session.start(OPTIONS);
    await gps(0, onRoute(0), 8, 400);
    expect(backend.sendPosition).not.toHaveBeenCalled();
  });

  it('sin señal lo indica y se recupera con la siguiente lectura', async () => {
    const { session, backend, gps } = setup();
    await session.start(OPTIONS);
    backend.sendPosition.mockRejectedValueOnce(new Error('Network request failed'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await gps(0, onRoute(0));
    expect(warn).toHaveBeenCalled(); // queda en el registro del teléfono
    warn.mockRestore();
    expect(session.getStatus()).toMatchObject({ state: 'sharing', problem: 'no_signal' });
    expect(shareMessage(session.getStatus(), T0).title).toBe('Sin señal');

    await gps(1_000, onRoute(10)); // tras un fallo se reintenta sin esperar
    expect(session.getStatus()).toMatchObject({ problem: null, lastSentAt: T0 + 1_000 });
  });

  it('fuera de Montería no envía, lo explica y sigue apenas entra a la ciudad', async () => {
    const { session, backend, gps } = setup();
    await session.start(OPTIONS);
    const cartagena = { latitude: 10.39, longitude: -75.48 };

    await gps(0, cartagena);
    expect(backend.sendPosition).not.toHaveBeenCalled();
    expect(session.getStatus()).toMatchObject({ state: 'sharing', problem: 'outside_area' });
    expect(shareMessage(session.getStatus(), T0).title).toBe('Estás fuera de Montería');

    await gps(10_000, onRoute(0));
    expect(backend.sendPosition).toHaveBeenCalledTimes(1);
    expect(session.getStatus()).toMatchObject({ problem: null });
  });

  it.each([
    ['clock', 'clock', 'La hora del teléfono no está bien'],
    ['too_frequent', 'rejected', 'El servidor no aceptó tu ubicación'],
  ] as const)('rechazo del servidor (%s) se explica como %s', async (reason, problem, title) => {
    const { session, backend, gps } = setup();
    await session.start(OPTIONS);
    const rejected = Object.assign(new Error('rechazada'), {
      name: 'PositionRejectedError',
      reason,
    });
    backend.sendPosition.mockRejectedValueOnce(rejected);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await gps(0, onRoute(0));
    warn.mockRestore();

    expect(session.getStatus()).toMatchObject({ problem });
    expect(shareMessage(session.getStatus(), T0).title).toBe(title);
  });

  it('"Dejar de compartir" apaga el GPS y cierra el viaje en el servidor', async () => {
    const { session, tracker, backend } = setup();
    await session.start(OPTIONS);
    await session.stop();

    expect(tracker.stop).toHaveBeenCalled();
    expect(backend.endTrip).toHaveBeenCalledWith('trip-1', 'user');
    expect(session.getStatus()).toEqual({
      state: 'ended',
      routeId: 'P3',
      reason: 'user',
      sharedMs: 0,
    });
  });

  it('se detiene solo al detectar que bajó del bus', async () => {
    const { session, tracker, backend, gps } = setup();
    await session.start(OPTIONS);
    // Bajó: camina a 150 m del recorrido durante 2 minutos.
    const away = { latitude: 8.7514, longitude: -75.88 };
    for (let t = 0; t <= 120_000; t += 10_000) await gps(t, away, 1);

    expect(session.getStatus()).toMatchObject({
      state: 'ended',
      routeId: 'P3',
      reason: 'auto_alighted',
      sharedMs: expect.any(Number),
    });
    expect(tracker.stop).toHaveBeenCalled();
    expect(backend.endTrip).toHaveBeenCalledWith('trip-1', 'auto_alighted');
    expect(shareMessage(session.getStatus(), 0).title).toBe('Bajaste del bus');
  });

  it('si el servidor ya cerró el viaje, solo apaga el GPS', async () => {
    const { session, tracker, backend, gps } = setup();
    await session.start(OPTIONS);
    const closed = Object.assign(new Error('cerrado'), { name: 'TripClosedError' });
    backend.sendPosition.mockRejectedValueOnce(closed);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await gps(0, onRoute(0));
    warn.mockRestore();
    await Promise.resolve();

    expect(session.getStatus()).toMatchObject({ state: 'ended', reason: 'timeout' });
    expect(tracker.stop).toHaveBeenCalled();
    expect(backend.endTrip).not.toHaveBeenCalled();
  });

  it('solo con la app abierta si no dio permiso "todo el tiempo"', async () => {
    const { session, tracker } = setup('foreground');
    await session.start(OPTIONS);
    expect(tracker.start).toHaveBeenCalledWith('foreground', 'Ruta P3', expect.any(Function));
    expect(shareMessage(session.getStatus(), T0).body).toMatch(/Mantén la app abierta/);
  });

  it.each([
    ['denied', 'permission'],
    ['services_off', 'location_off'],
  ] as const)('permiso %s: no crea viaje y explica el error', async (permission, error) => {
    const { session, backend } = setup(permission);
    await session.start(OPTIONS);
    expect(backend.startTrip).not.toHaveBeenCalled();
    expect(session.getStatus()).toEqual({ state: 'error', routeId: 'P3', error });
  });

  it('sin backend configurado no finge que comparte', async () => {
    const t = setup();
    t.withoutBackend();
    await t.session.start(OPTIONS);
    expect(t.tracker.requestPermission).not.toHaveBeenCalled();
    expect(t.session.getStatus()).toMatchObject({ state: 'error', error: 'no_backend' });
  });

  it('sin conexión al empezar: error con opción de reintentar', async () => {
    const { session, backend, tracker } = setup();
    backend.startTrip.mockRejectedValueOnce(new Error('offline'));
    await session.start(OPTIONS);
    expect(session.getStatus()).toMatchObject({ state: 'error', error: 'network' });
    expect(shareMessage(session.getStatus(), T0).action).toBe('retry');
    expect(tracker.start).not.toHaveBeenCalled();

    await session.retry();
    expect(session.getStatus()).toMatchObject({ state: 'sharing' });
  });

  it('si el usuario detiene mientras se crea el viaje, el viaje se cierra', async () => {
    const { session, backend, tracker } = setup();
    let resolveTrip: (id: string) => void = () => {};
    backend.startTrip.mockImplementationOnce(() => new Promise((r) => (resolveTrip = r)));
    const starting = session.start(OPTIONS);
    await Promise.resolve();
    await session.stop();
    resolveTrip('trip-tarde');
    await starting;

    expect(session.getStatus()).toMatchObject({ state: 'ended' });
    expect(tracker.start).not.toHaveBeenCalled();
    expect(backend.endTrip).toHaveBeenCalledWith('trip-tarde', 'user');
  });

  it('lecturas sin viaje activo (tras recargar la app) apagan el GPS', async () => {
    const { session, tracker } = setup();
    session.handleSamples([{ timestamp: T0, coordinate: onRoute(0), speedMps: 5, accuracy: 5 }]);
    expect(tracker.stop).toHaveBeenCalled();
  });

  it('avisa a quien escucha y reset vuelve al inicio', async () => {
    const { session } = setup();
    const listener = jest.fn();
    const unsubscribe = session.subscribe(listener);
    await session.start(OPTIONS);
    expect(listener).toHaveBeenCalled();
    await session.reset();
    expect(session.getStatus()).toEqual({ state: 'idle' });
    unsubscribe();
  });
});

describe('reportar el cupo', () => {
  it('se envía en el viaje activo y luego solo cada 2 minutos', async () => {
    const t = setup();
    await t.session.start(OPTIONS);
    expect(await t.session.reportOccupancy('full')).toEqual({ kind: 'sent' });
    expect(t.backend.reportOccupancy).toHaveBeenCalledWith('trip-1', 'P3', 'full');

    await t.gps(30_000, onRoute(0));
    expect(await t.session.reportOccupancy('medium')).toEqual({ kind: 'too_soon', waitMinutes: 2 });
    await t.gps(70_000, onRoute(300));
    expect(await t.session.reportOccupancy('medium')).toEqual({ kind: 'too_soon', waitMinutes: 1 });
    expect(t.backend.reportOccupancy).toHaveBeenCalledTimes(1);

    await t.gps(121_000, onRoute(600));
    expect(await t.session.reportOccupancy('medium')).toEqual({ kind: 'sent' });
  });

  it('máximo 10 por viaje', async () => {
    const t = setup();
    await t.session.start(OPTIONS);
    for (let i = 0; i < MAX_OCCUPANCY_REPORTS; i++) {
      await t.gps(i * 121_000, onRoute(i * 400));
      expect(await t.session.reportOccupancy('full')).toEqual({ kind: 'sent' });
    }
    await t.gps(MAX_OCCUPANCY_REPORTS * 121_000, onRoute(4_400));
    expect(await t.session.reportOccupancy('full')).toEqual({ kind: 'max_reached' });
  });

  it('sin compartir no se puede reportar', async () => {
    const t = setup();
    expect(await t.session.reportOccupancy('full')).toEqual({ kind: 'not_sharing' });
    expect(t.backend.reportOccupancy).not.toHaveBeenCalled();
  });

  it('respeta el límite del servidor y distingue la falta de conexión', async () => {
    const t = setup();
    await t.session.start(OPTIONS);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    t.backend.reportOccupancy.mockRejectedValueOnce(
      Object.assign(new Error('límite'), { name: 'OccupancyLimitError', reason: 'too_soon' }),
    );
    expect(await t.session.reportOccupancy('full')).toEqual({ kind: 'too_soon', waitMinutes: 2 });

    const t2 = setup();
    await t2.session.start(OPTIONS);
    t2.backend.reportOccupancy.mockRejectedValueOnce(new Error('Network request failed'));
    expect(await t2.session.reportOccupancy('full')).toEqual({ kind: 'offline' });
    // Tras un fallo de red se puede reintentar enseguida.
    expect(await t2.session.reportOccupancy('full')).toEqual({ kind: 'sent' });
    warn.mockRestore();
  });
});

describe('reportar incidentes', () => {
  it('cada tipo una vez por viaje', async () => {
    const t = setup();
    await t.session.start(OPTIONS);
    expect(await t.session.reportIncident('broken_down')).toEqual({ kind: 'sent' });
    expect(t.backend.reportIncident).toHaveBeenCalledWith('trip-1', 'P3', 'broken_down');
    expect(t.session.hasReported('broken_down')).toBe(true);
    expect(await t.session.reportIncident('broken_down')).toEqual({ kind: 'already_reported' });
    expect(await t.session.reportIncident('big_delay')).toEqual({ kind: 'sent' });
    expect(t.backend.reportIncident).toHaveBeenCalledTimes(2);
  });

  it('sin compartir no se puede; sin conexión se puede reintentar', async () => {
    const t = setup();
    expect(await t.session.reportIncident('detour')).toEqual({ kind: 'not_sharing' });
    await t.session.start(OPTIONS);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    t.backend.reportIncident.mockRejectedValueOnce(new Error('Network request failed'));
    expect(await t.session.reportIncident('detour')).toEqual({ kind: 'offline' });
    expect(await t.session.reportIncident('detour')).toEqual({ kind: 'sent' });
    warn.mockRestore();
  });

  it('marca el viaje como "quieto" tras 5 minutos sin moverse sobre el recorrido', async () => {
    const t = setup();
    await t.session.start(OPTIONS);
    for (let s = 0; s < 290; s += 10) await t.gps(s * 1000, onRoute(500), 0);
    expect(t.session.getStatus()).toMatchObject({ state: 'sharing', stuck: false });
    for (let s = 290; s <= 310; s += 10) await t.gps(s * 1000, onRoute(500), 0);
    expect(t.session.getStatus()).toMatchObject({ state: 'sharing', stuck: true });
    // Vuelve a andar: deja de estar quieto.
    await t.gps(320_000, onRoute(600), 8);
    await t.gps(330_000, onRoute(700), 8);
    expect(t.session.getStatus()).toMatchObject({ stuck: false });
  });
});

describe('shareMessage', () => {
  it('muestra hace cuánto fue el último envío', () => {
    const status = {
      state: 'sharing',
      routeId: 'P3',
      tripId: 't',
      mode: 'background',
      startedAt: 0,
      lastSentAt: 1_000,
      problem: null,
      stuck: false,
    } as const;
    expect(shareMessage(status, 9_000).body).toBe('Último envío hace 8 s.');
    expect(shareMessage(status, 181_000).body).toBe('Último envío hace 3 min.');
    expect(shareMessage({ ...status, lastSentAt: null }, 0).body).toBe(
      'Enviando tu primera ubicación…',
    );
  });
});
