/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import dataset from '../dataset.json';
import { DESTINATIONS } from '../destinations';
import { distanceMeters } from '../geo';
import { importFromCsv, REQUIRED_FILES, type CsvFiles } from '../importCsv';
import type { TransitDataset } from '../model';
import { routesRepository } from '../repository';
import { validateDataset } from '../validate';

const ROUTE_IDS = ['6M', 'AE', 'D1', 'M1', 'P1', 'P2', 'P3', 'RG', 'S1', 'T2'];

describe('dataset.json (seed)', () => {
  it('es válido', () => {
    expect(validateDataset(dataset as unknown as TransitDataset)).toEqual([]);
  });

  it('está marcado como ficticio', () => {
    expect(dataset.source.kind).toBe('seed');
    expect(dataset.source.description).toMatch(/FICTICIOS/);
    for (const route of routesRepository.listRoutes()) {
      for (const p of route.patterns) expect(p.quality).toBe('ficticio');
      for (const s of route.service) expect(s.quality).toBe('ficticio');
    }
  });

  it('tiene las 10 rutas que pasan por Unicórdoba', () => {
    expect(routesRepository.listRoutes().map((r) => r.id)).toEqual(ROUTE_IDS);
  });

  it('todas las rutas pasan a menos de 300 m de la sede Montería', () => {
    const campus = DESTINATIONS[0].coordinate;
    for (const id of ROUTE_IDS) {
      const stop = routesRepository.nearestPatternStop(id, campus);
      expect(stop && distanceMeters(stop.coordinate, campus)).toBeLessThan(300);
    }
    expect(routesRepository.routesNear(campus, 300)).toHaveLength(10);
  });

  it('coincide con lo que genera el script desde data/seed (npm run data:seed)', () => {
    const dir = join(__dirname, '../../../data/seed');
    const files = Object.fromEntries(
      REQUIRED_FILES.map((name) => [name, readFileSync(join(dir, name), 'utf8')]),
    ) as CsvFiles;
    const result = importFromCsv(files, {
      kind: 'seed',
      description: dataset.source.description,
      generatedAt: dataset.source.generatedAt,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dataset).toEqual(dataset);
  });
});
