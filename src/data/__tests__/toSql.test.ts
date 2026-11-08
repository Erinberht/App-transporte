import { BUNDLED_DATASET } from '../repository';
import { datasetToSql } from '../toSql';

describe('datasetToSql', () => {
  const sql = datasetToSql(BUNDLED_DATASET);

  it('es una transacción con todas las tablas del catálogo', () => {
    expect(sql).toMatch(/^-- GENERADO/);
    expect(sql).toContain('begin;');
    expect(sql.trim().endsWith('commit;')).toBe(true);
    for (const table of [
      'dataset_meta',
      'stops',
      'routes',
      'route_patterns',
      'pattern_stops',
      'service_headways',
    ]) {
      expect(sql).toContain(`insert into public.${table}`);
    }
  });

  it('incluye cada ruta y parada, con longitud antes que latitud (PostGIS)', () => {
    for (const route of BUNDLED_DATASET.routes) expect(sql).toContain(`('${route.id}', `);
    expect(sql).toContain('st_makepoint(-75.8605, 8.7895)'); // Unicórdoba
  });

  it('escapa comillas simples', () => {
    const ds = JSON.parse(JSON.stringify(BUNDLED_DATASET));
    ds.stops[0].name = "Tienda D'Luis";
    expect(datasetToSql(ds)).toContain("'Tienda D''Luis'");
  });

  it('no borra rutas ni paradas (pueden tener viajes asociados)', () => {
    expect(sql).not.toMatch(/delete from public\.(routes|stops)\b/);
  });

  it('rechaza números no finitos', () => {
    const ds = JSON.parse(JSON.stringify(BUNDLED_DATASET));
    ds.stops[0].coordinate.latitude = Number.NaN;
    expect(() => datasetToSql(ds)).toThrow(/Número inválido/);
  });
});
