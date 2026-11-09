/// <reference types="node" />
// Genera los QR de las busetas para imprimir y pegar dentro del bus (formato: docs/QR_FORMAT.md).
//
//   npm run qr:generate                                  (data/seed/buses.csv -> data/qr/)
//   npm run qr:generate -- --in otras.csv --out carpeta
//
// Escribe un SVG por bus y una hoja index.html lista para imprimir.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import QRCode from 'qrcode';

import { parseCsv } from '../src/data/importCsv.ts';
import { formatBusQr } from '../src/qr/busQr.ts';

const { values } = parseArgs({
  options: {
    in: { type: 'string', default: 'data/seed/buses.csv' },
    out: { type: 'string', default: 'data/qr' },
  },
});

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

try {
  const buses = parseCsv(readFileSync(values.in, 'utf8')).map((row) => ({
    code: (row.code ?? '').trim().toUpperCase(),
    routeId: (row.route_id ?? '').trim(),
  }));
  const out = resolve(values.out);
  mkdirSync(out, { recursive: true });

  const cards: string[] = [];
  for (const bus of buses) {
    const text = formatBusQr(bus.code); // lanza si el código es inválido
    // Corrección de errores "M" (15 %): aguanta rayones y algo de suciedad.
    const svg = await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
    writeFileSync(join(out, `${bus.code}.svg`), svg);
    cards.push(
      `<figure>${svg}<figcaption><strong>${escape(bus.code)}</strong><span>Ruta ${escape(
        bus.routeId,
      )}</span><small>Escanea con Mi bus para compartir tu recorrido</small></figcaption></figure>`,
    );
  }

  writeFileSync(
    join(out, 'index.html'),
    `<!DOCTYPE html>
<html lang="es-CO"><head><meta charset="utf-8"><title>QR de busetas · Mi bus</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; color: #182b43; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(6cm, 1fr)); gap: 12px; }
  figure { margin: 0; padding: 12px; border: 1px dashed #9aa7b6; text-align: center; break-inside: avoid; }
  figure svg { width: 5cm; height: 5cm; }
  figcaption { display: grid; gap: 2px; }
  small { color: #68788b; }
  @media print { p { display: none; } }
</style></head>
<body><p>${buses.length} busetas desde ${escape(values.in)}. Datos de prueba: no pegar en buses reales.</p>
<main>${cards.join('\n')}</main></body></html>
`,
  );
  console.log(`OK: ${buses.length} QR -> ${out}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
