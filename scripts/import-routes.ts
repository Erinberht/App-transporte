/// <reference types="node" />
// Importa rutas desde una carpeta de CSV y genera el JSON que lee la app.
//
//   npm run data:import -- <carpeta> [--kind seed|import] [--description "..."] [--out archivo.json]
//
// Ejemplos:
//   npm run data:seed                                  (regenera los datos ficticios de data/seed)
//   npm run data:import -- data/real --description "Recorridos levantados con GPS, nov. 2026"
//
// Formato de los CSV: docs/DATA_MODEL.md. Si hay errores no escribe nada y termina con código 1.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { importFromCsv, REQUIRED_FILES, type CsvFiles } from '../src/data/importCsv.ts';

const DEFAULT_OUT = 'src/data/dataset.json';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    kind: { type: 'string', default: 'import' },
    description: { type: 'string' },
    out: { type: 'string', default: DEFAULT_OUT },
  },
});

const dir = positionals[0];
if (!dir) {
  console.error(
    'Uso: npm run data:import -- <carpeta-con-csv> [--kind seed|import] [--out archivo.json]',
  );
  process.exit(1);
}
if (values.kind !== 'seed' && values.kind !== 'import') {
  console.error('--kind debe ser "seed" o "import"');
  process.exit(1);
}

const missing = REQUIRED_FILES.filter((name) => !existsSync(join(dir, name)));
if (missing.length > 0) {
  console.error(`Faltan archivos en ${dir}: ${missing.join(', ')}`);
  process.exit(1);
}

const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const files: CsvFiles = {
  'routes.csv': read('routes.csv'),
  'stops.csv': read('stops.csv'),
  'patterns.csv': read('patterns.csv'),
  'pattern_stops.csv': read('pattern_stops.csv'),
  'service.csv': read('service.csv'),
  ...(existsSync(join(dir, 'shapes.csv')) ? { 'shapes.csv': read('shapes.csv') } : {}),
};

const description =
  values.description ??
  (values.kind === 'seed'
    ? 'Datos FICTICIOS para desarrollo: códigos y nombres de rutas reales de Metrosinú, pero paradas, recorridos y horarios inventados. No usar para viajar.'
    : `Importado desde ${dir}`);

const result = importFromCsv(files, { kind: values.kind, description });

if (!result.ok) {
  console.error(`No se generó ${values.out}. Errores:`);
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}

for (const w of result.warnings) console.warn(`  aviso: ${w}`);
const out = resolve(values.out);
writeFileSync(out, `${JSON.stringify(result.dataset, null, 2)}\n`);
const { routes, stops } = result.dataset;
console.log(`OK: ${routes.length} rutas y ${stops.length} paradas -> ${out}`);
