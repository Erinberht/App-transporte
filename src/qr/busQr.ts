// Formato del QR de las busetas (ver docs/QR_FORMAT.md):
//
//   mibus://bus/v1/<código>        ej. mibus://bus/v1/PRUEBA-P3-01
//
// El QR solo identifica el bus: la ruta se consulta en el servidor, así un bus que cambia de
// ruta no necesita QR nuevo. Sin importaciones de valores para que Node lo use desde scripts.

export const BUS_QR_PREFIX = 'mibus://bus/';
export const BUS_QR_VERSION = 'v1';

/** Letras mayúsculas, números y guiones; de 2 a 32 caracteres. */
export const BUS_CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9-]{0,30}[A-Z0-9])?$/;

export type BusQrResult =
  | { ok: true; code: string }
  /** No es un QR de Mi bus (otro enlace, un texto...). */
  | { ok: false; reason: 'not_mibus' }
  /** Es de Mi bus pero de una versión del formato que esta app no conoce. */
  | { ok: false; reason: 'unsupported_version' }
  /** Es de Mi bus pero el código está mal formado. */
  | { ok: false; reason: 'bad_code' };

export function isValidBusCode(code: string): boolean {
  return BUS_CODE_PATTERN.test(code);
}

/** Texto que lleva el QR de un bus. */
export function formatBusQr(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!isValidBusCode(normalized)) throw new Error(`Código de bus inválido: ${code}`);
  return `${BUS_QR_PREFIX}${BUS_QR_VERSION}/${normalized}`;
}

/** Interpreta lo que leyó la cámara. Tolera mayúsculas/minúsculas, espacios y "/" final. */
export function parseBusQr(data: string): BusQrResult {
  const text = data.trim();
  if (!text.toLowerCase().startsWith(BUS_QR_PREFIX)) return { ok: false, reason: 'not_mibus' };
  const [version, rawCode, ...rest] = text
    .slice(BUS_QR_PREFIX.length)
    .replace(/\/+$/, '')
    .split('/');
  if (version?.toLowerCase() !== BUS_QR_VERSION)
    return { ok: false, reason: 'unsupported_version' };
  const code = decodeURIComponent(rawCode ?? '').toUpperCase();
  if (rest.length > 0 || !isValidBusCode(code)) return { ok: false, reason: 'bad_code' };
  return { ok: true, code };
}
