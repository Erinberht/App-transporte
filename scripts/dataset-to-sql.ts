/// <reference types="node" />
// Genera el SQL que carga el catálogo de rutas en Supabase a partir del JSON de la app.
//
//   npm run data:sql                                   (src/data/dataset.json -> supabase/seed.sql)
//   npm run data:sql -- --in otro.json --out carga.sql
//
// En local, `npx supabase db reset` aplica migraciones y luego supabase/seed.sql.
// En la nube: ver docs/BACKEND.md ("Cargar rutas en la nube").
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { datasetToSql } from '../src/data/toSql.ts';
import { parseDataset } from '../src/data/validate.ts';

const { values } = parseArgs({
  options: {
    in: { type: 'string', default: 'src/data/dataset.json' },
    out: { type: 'string', default: 'supabase/seed.sql' },
  },
});

try {
  const dataset = parseDataset(JSON.parse(readFileSync(values.in, 'utf8')));
  const out = resolve(values.out);
  writeFileSync(out, datasetToSql(dataset));
  console.log(`OK: ${dataset.routes.length} rutas -> ${out}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
