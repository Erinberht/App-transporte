import type { TransitDataset } from '../model';
import { isInMonteria, parseDataset, parseHHMM, validateDataset } from '../validate';

function sample(): TransitDataset {
  return {
    schemaVersion: 1,
    source: { kind: 'seed', description: 'prueba', generatedAt: '2026-11-08T00:00:00Z' },
    stops: [
      { id: 'a', name: 'A', coordinate: { latitude: 8.75, longitude: -75.88 } },
      { id: 'b', name: 'B', coordinate: { latitude: 8.79, longitude: -75.86 } },
    ],
    routes: [
      {
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
              { stopId: 'b', minutesFromStart: 10 },
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
              { from: '05:00', to: '08:00', everyMinutes: 10 },
              { from: '08:00', to: '22:00', everyMinutes: 15 },
            ],
          },
        ],
      },
    ],
  };
}

describe('validateDataset', () => {
  it('acepta un conjunto correcto', () => {
    expect(validateDataset(sample())).toEqual([]);
  });

  it('rechaza paradas fuera de Montería', () => {
    const ds = sample();
    ds.stops[0].coordinate = { latitude: 4.71, longitude: -74.07 }; // Bogotá
    expect(validateDataset(ds)).toContain('Parada a: coordenada fuera de Montería');
  });

  it('rechaza latitud y longitud invertidas', () => {
    const ds = sample();
    ds.stops[1].coordinate = { latitude: -75.86, longitude: 8.79 };
    expect(validateDataset(ds).join()).toMatch(/fuera de Montería/);
  });

  it('rechaza paradas desconocidas, ids repetidos y minutos que retroceden', () => {
    const ds = sample();
    ds.stops.push({ ...ds.stops[0] });
    ds.routes[0].patterns[0].stops = [
      { stopId: 'a', minutesFromStart: 5 },
      { stopId: 'zz', minutesFromStart: 2 },
    ];
    const errors = validateDataset(ds);
    expect(errors).toContain('Parada repetida: a');
    expect(errors).toContain('Ruta X1 / X1-0: parada desconocida zz');
    expect(errors).toContain('Ruta X1 / X1-0: los minutos retroceden en zz');
  });

  it('rechaza franjas solapadas, invertidas y frecuencias inválidas', () => {
    const ds = sample();
    ds.routes[0].service[0].headways = [
      { from: '05:00', to: '09:00', everyMinutes: 10 },
      { from: '08:00', to: '07:00', everyMinutes: 0 },
      { from: '25:00', to: '26:00', everyMinutes: 5 },
    ];
    const errors = validateDataset(ds).join('\n');
    expect(errors).toMatch(/solapadas/);
    expect(errors).toMatch(/no avanza/);
    expect(errors).toMatch(/frecuencia inválida/);
    expect(errors).toMatch(/hora inválida 25:00/);
  });

  it('rechaza color, sentido y calidad inválidos', () => {
    const ds = sample();
    ds.routes[0].color = 'rojo';
    (ds.routes[0].patterns[0] as { direction: number }).direction = 2;
    (ds.routes[0].patterns[0] as { quality: string }).quality = 'quizás';
    const errors = validateDataset(ds).join('\n');
    expect(errors).toMatch(/color inválido/);
    expect(errors).toMatch(/direction debe ser 0 o 1/);
    expect(errors).toMatch(/quality inválida/);
  });

  it('parseDataset lanza con todos los errores', () => {
    const ds = sample();
    ds.routes = [];
    expect(() => parseDataset(ds)).toThrow(/No hay rutas/);
    expect(() => parseDataset({})).toThrow(/Datos de rutas inválidos/);
  });
});

describe('utilidades', () => {
  it('parseHHMM', () => {
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('06:30')).toBe(390);
    expect(parseHHMM('24:00')).toBe(1440);
    expect(parseHHMM('24:30')).toBeNull();
    expect(parseHHMM('6:30')).toBeNull();
    expect(parseHHMM('12:60')).toBeNull();
  });

  it('isInMonteria', () => {
    expect(isInMonteria({ latitude: 8.7575, longitude: -75.8851 })).toBe(true);
    expect(isInMonteria({ latitude: 8.8236, longitude: -75.8258 })).toBe(true); // aeropuerto
    expect(isInMonteria({ latitude: 10.39, longitude: -75.51 })).toBe(false); // Cartagena
    expect(isInMonteria({ latitude: NaN, longitude: -75.88 })).toBe(false);
  });
});
