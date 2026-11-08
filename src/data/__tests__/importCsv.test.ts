import { importFromCsv, parseCsv, type CsvFiles } from '../importCsv';

const OPTIONS = {
  kind: 'import' as const,
  description: 'prueba',
  generatedAt: '2026-11-08T00:00:00Z',
};

const csv = (...lines: string[]) => `${lines.join('\n')}\n`;

function files(overrides: Partial<CsvFiles> = {}): CsvFiles {
  return {
    'routes.csv': csv(
      'route_id,short_name,long_name,operator,color',
      'X1,X1,"Prueba, con coma",Metrosinú,#123456',
    ),
    'stops.csv': csv(
      'stop_id,name,lat,lng',
      'a,Parada A,8.7500,-75.8800',
      'b,Parada B,8.7600,-75.8800',
      'c,Parada C,8.7700,-75.8800',
    ),
    'patterns.csv': csv(
      'pattern_id,route_id,direction,headsign,quality',
      'X1-0,X1,0,Unicórdoba,verificado',
    ),
    // Desordenado a propósito: el orden lo da "sequence".
    'pattern_stops.csv': csv(
      'pattern_id,sequence,stop_id,minutes_from_start',
      'X1-0,3,c,',
      'X1-0,1,a,',
      'X1-0,2,b,',
    ),
    'service.csv': csv(
      'route_id,days,from,to,every_minutes,quality',
      'X1,weekday,08:00,12:00,15,verificado',
      'X1,weekday,05:00,08:00,10,verificado',
      'X1,saturday,06:00,20:00,20,aproximado',
    ),
    ...overrides,
  };
}

describe('parseCsv', () => {
  it('lee comillas, comas internas, CRLF, BOM y filas vacías', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","dice ""hola"""\r\n\r\n1,2');
    expect(rows).toEqual([
      { a: 'x, y', b: 'dice "hola"' },
      { a: '1', b: '2' },
    ]);
  });

  it('archivo vacío = sin filas', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('importFromCsv', () => {
  it('construye rutas, ordena paradas y franjas, y estima minutos', () => {
    const result = importFromCsv(files(), OPTIONS);
    if (!result.ok) throw new Error(result.errors.join('\n'));

    const [route] = result.dataset.routes;
    expect(route.longName).toBe('Prueba, con coma');
    const [pattern] = route.patterns;
    expect(pattern.stops.map((s) => s.stopId)).toEqual(['a', 'b', 'c']);
    // ~1,1 km por tramo a 18 km/h ≈ 3,7 min (+0,5 min de parada en la intermedia)
    expect(pattern.stops.map((s) => s.minutesFromStart)).toEqual([0, 4, 8]);
    expect(pattern.shape).toHaveLength(3);
    const weekday = route.service.find((s) => s.days === 'weekday');
    expect(weekday?.headways.map((h) => h.from)).toEqual(['05:00', '08:00']);
    expect(result.warnings.join('\n')).toMatch(/estimados a 18 km\/h/);
    expect(result.warnings.join('\n')).toMatch(/sin shapes.csv/);
  });

  it('respeta los minutos del CSV y el trazado de shapes.csv', () => {
    const result = importFromCsv(
      files({
        'pattern_stops.csv': csv(
          'pattern_id,sequence,stop_id,minutes_from_start',
          'X1-0,1,a,0',
          'X1-0,2,b,6',
          'X1-0,3,c,11',
        ),
        'shapes.csv': csv(
          'pattern_id,sequence,lat,lng',
          'X1-0,2,8.755,-75.881',
          'X1-0,1,8.75,-75.88',
          'X1-0,3,8.77,-75.88',
        ),
      }),
      OPTIONS,
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const [pattern] = result.dataset.routes[0].patterns;
    expect(pattern.stops.map((s) => s.minutesFromStart)).toEqual([0, 6, 11]);
    expect(pattern.shape[1]).toEqual({ latitude: 8.755, longitude: -75.881 });
    expect(result.warnings).toEqual([]);
  });

  it('informa columnas faltantes con archivo y fila', () => {
    const result = importFromCsv(
      files({ 'stops.csv': csv('stop_id,name,lat,lng', 'a,Parada A,,-75.88') }),
      OPTIONS,
    );
    expect(result).toEqual({ ok: false, errors: ['stops.csv, fila 2: falta "lat"'] });
  });

  it('informa números inválidos', () => {
    const result = importFromCsv(
      files({ 'stops.csv': csv('stop_id,name,lat,lng', 'a,A,ocho,-75.88') }),
      OPTIONS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/"lat" no es un número/);
  });

  it('no genera nada si los datos no pasan la validación', () => {
    const result = importFromCsv(
      files({
        'pattern_stops.csv': csv(
          'pattern_id,sequence,stop_id,minutes_from_start',
          'X1-0,1,a,0',
          'X1-0,2,nope,5',
        ),
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toMatch(/parada desconocida nope/);
  });

  it('avisa de recorridos de rutas que no existen', () => {
    const result = importFromCsv(
      files({
        'patterns.csv': csv(
          'pattern_id,route_id,direction,headsign,quality',
          'X1-0,X1,0,Unicórdoba,verificado',
          'Z9-0,Z9,0,Otro,verificado',
        ),
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.warnings).toContain('patterns.csv: ruta desconocida Z9 (ignorada)');
  });
});
