/// <reference types="node" />
// Genera el SQL que carga el catálogo de rutas en Supabase a partir del JSON de la app.
//
//   npm run data:sql      (src/data/dataset.json + data/seed/buses.csv -> supabase/seed.sql)
//   npm run data:sql -- --in otro.json --out carga.sql
//
// En local, `npx supabase db reset` aplica migraciones y luego supabase/seed.sql.
// En la nube: ver docs/BACKEND.md ("Cargar rutas en la nube").
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { parseCsv } from '../src/data/importCsv.ts';
import { busesToSql, datasetToSql } from '../src/data/toSql.ts';
import { parseDataset } from '../src/data/validate.ts';
import { isValidBusCode } from '../src/qr/busQr.ts';

const { values } = parseArgs({
  options: {
    in: { type: 'string', default: 'src/data/dataset.json' },
    out: { type: 'string', default: 'supabase/seed.sql' },
    buses: { type: 'string', default: 'data/seed/buses.csv' },
  },
});

try {
  const dataset = parseDataset(JSON.parse(readFileSync(values.in, 'utf8')));
  const routeIds = new Set(dataset.routes.map((r) => r.id));
  const buses = parseCsv(readFileSync(values.buses, 'utf8')).map((row, i) => {
    const code = (row.code ?? '').trim().toUpperCase();
    const routeId = (row.route_id ?? '').trim();
    if (!isValidBusCode(code))
      throw new Error(`${values.buses} fila ${i + 2}: código inválido "${code}"`);
    if (!routeIds.has(routeId))
      throw new Error(`${values.buses} fila ${i + 2}: ruta desconocida "${routeId}"`);
    return { code, routeId };
  });
  const out = resolve(values.out);
  writeFileSync(out, datasetToSql(dataset) + busesToSql(buses, values.buses));
  console.log(`OK: ${dataset.routes.length} rutas y ${buses.length} busetas -> ${out}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
