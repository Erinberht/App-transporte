import { distanceMeters, distanceToPathMeters, type LatLng } from '../../data/geo';
import { detectTripEnd, MAX_TRIP_MS, pruneSamples, type LocationSample } from '../alighting';

// Recorrido de prueba: una calle recta de oeste a este (~2,2 km) que termina en la parada U.
const PATH: LatLng[] = [
  { latitude: 8.75, longitude: -75.89 },
  { latitude: 8.75, longitude: -75.87 },
];
const STOP_U = PATH[1];
const T0 = 1_800_000_000_000;
const trip = { path: PATH, alightStop: STOP_U, startedAt: T0 };

/** Desplazamiento en metros hacia el norte (dy) y el este (dx). */
const offset = (p: LatLng, dy: number, dx = 0): LatLng => ({
  latitude: p.latitude + dy / 111_195,
  longitude: p.longitude + dx / (111_195 * Math.cos((p.latitude * Math.PI) / 180)),
});

function sample(at: number, coordinate: LatLng, speedMps: number | null = null, accuracy = 10) {
  return { timestamp: at, coordinate, speedMps, accuracy } satisfies LocationSample;
}

/** Una lectura cada 10 s entre `from` y `to` (ms desde T0), en la posición que diga `where`. */
function track(from: number, to: number, where: (t: number) => LatLng, speed: number | null) {
  const out: LocationSample[] = [];
  for (let t = from; t <= to; t += 10_000) out.push(sample(T0 + t, where(t), speed));
  return out;
}

describe('distanceToPathMeters', () => {
  it('mide la distancia perpendicular al segmento', () => {
    const p = offset({ latitude: 8.75, longitude: -75.88 }, 100);
    expect(distanceToPathMeters(p, PATH)).toBeCloseTo(100, 0);
  });

  it('más allá del extremo, la distancia al extremo', () => {
    const p = offset(STOP_U, 0, 300);
    expect(distanceToPathMeters(p, PATH)).toBeCloseTo(distanceMeters(p, STOP_U), 0);
  });
});

describe('detectTripEnd', () => {
  const midRoute = (t: number) => offset(PATH[0], 0, 300 + t / 100); // avanza sobre la calle

  it('en el bus (rápido y sobre el recorrido) sigue compartiendo', () => {
    const samples = track(0, 180_000, midRoute, 8);
    expect(detectTripEnd(samples, trip, T0 + 180_000)).toBeNull();
  });

  it('en un trancón (quieto pero sobre el recorrido) sigue compartiendo', () => {
    const samples = track(0, 300_000, () => offset(PATH[0], 10, 500), 0);
    expect(detectTripEnd(samples, trip, T0 + 300_000)).toBeNull();
  });

  it('dos minutos caminando lejos del recorrido: bajó', () => {
    const walking = (t: number) => offset(PATH[0], 120 + t / 1000, 500);
    const samples = track(0, 120_000, walking, 1.2);
    expect(detectTripEnd(samples, trip, T0 + 120_000)).toBe('auto_alighted');
  });

  it('un minuto lejos del recorrido aún no basta (puede ser un desvío corto)', () => {
    const samples = track(60_000, 120_000, () => offset(PATH[0], 150, 500), 1);
    expect(detectTripEnd(samples, trip, T0 + 120_000)).toBeNull();
  });

  it('lejos del recorrido pero en carro o bus (rápido): no bajó', () => {
    const samples = track(0, 150_000, (t) => offset(PATH[0], 200, 500 + t / 100), 9);
    expect(detectTripEnd(samples, trip, T0 + 150_000)).toBeNull();
  });

  it('un minuto a paso de caminata junto a la parada de bajada: bajó', () => {
    const samples = [
      ...track(0, 60_000, midRoute, 8),
      ...track(70_000, 140_000, () => offset(STOP_U, 40), 0.8),
    ];
    expect(detectTripEnd(samples, trip, T0 + 140_000)).toBe('auto_alighted');
  });

  it('calcula la velocidad con las posiciones si el GPS no la da', () => {
    // Sin velocidad del GPS: se mueve 100 m cada 10 s (36 km/h) → va en el bus.
    const fast = track(0, 130_000, (t) => offset(PATH[0], 200, t / 100), null);
    expect(detectTripEnd(fast, trip, T0 + 130_000)).toBeNull();
    const slow = track(0, 130_000, (t) => offset(PATH[0], 200, 500 + t / 10_000), null);
    expect(detectTripEnd(slow, trip, T0 + 130_000)).toBe('auto_alighted');
  });

  it('ignora lecturas imprecisas', () => {
    const blurry = track(0, 130_000, () => offset(PATH[0], 300, 500), 0).map((s) => ({
      ...s,
      accuracy: 500,
    }));
    expect(detectTripEnd(blurry, trip, T0 + 130_000)).toBeNull();
    expect(pruneSamples(blurry, T0 + 130_000)).toHaveLength(0);
  });

  it('a los 90 minutos deja de compartir aunque no detecte la bajada', () => {
    expect(detectTripEnd([], trip, T0 + MAX_TRIP_MS)).toBe('timeout');
    expect(detectTripEnd([], trip, T0 + MAX_TRIP_MS - 1)).toBeNull();
  });
});
