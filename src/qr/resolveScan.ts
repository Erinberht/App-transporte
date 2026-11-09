// Qué hacer con lo que leyó la cámara: interpretar el QR y validarlo contra el servidor.
import type { BusInfo } from '../api/transit';
import { parseBusQr } from './busQr';

export type ScanOutcome =
  /** Bus válido de la ruta elegida: se vincula. */
  | { kind: 'linked'; bus: BusInfo }
  /** Bus válido de otra ruta: se pregunta si cambiar de ruta. */
  | { kind: 'other_route'; bus: BusInfo }
  /** El QR no sirve. */
  | { kind: 'invalid'; reason: 'not_mibus' | 'unsupported_version' | 'bad_code' | 'unknown_bus' }
  /** No se pudo validar. */
  | { kind: 'error'; reason: 'no_backend' | 'network' };

export type BusLookup = (code: string) => Promise<BusInfo | null>;

export async function resolveScan(
  data: string,
  routeId: string,
  lookup: BusLookup | null,
): Promise<ScanOutcome> {
  const parsed = parseBusQr(data);
  if (!parsed.ok) return { kind: 'invalid', reason: parsed.reason };
  if (!lookup) return { kind: 'error', reason: 'no_backend' };
  let bus: BusInfo | null;
  try {
    bus = await lookup(parsed.code);
  } catch {
    return { kind: 'error', reason: 'network' };
  }
  if (!bus) return { kind: 'invalid', reason: 'unknown_bus' };
  return bus.routeId === routeId ? { kind: 'linked', bus } : { kind: 'other_route', bus };
}

/** Explicación para el usuario cuando el QR no se pudo usar. */
export function scanProblemText(outcome: Extract<ScanOutcome, { kind: 'invalid' | 'error' }>) {
  switch (outcome.reason) {
    case 'not_mibus':
      return {
        title: 'Este QR no es de Mi bus',
        body: 'Busca el QR de Mi bus pegado dentro de la buseta.',
      };
    case 'unsupported_version':
      return {
        title: 'Este QR es de una versión más nueva',
        body: 'Actualiza la app para poder usarlo.',
      };
    case 'bad_code':
      return { title: 'El QR está dañado', body: 'Intenta de nuevo o sigue sin escanear.' };
    case 'unknown_bus':
      return {
        title: 'Bus no registrado',
        body: 'Este bus no está en Mi bus o ya no está activo. Puedes compartir solo con la ruta.',
      };
    case 'no_backend':
      return {
        title: 'No se puede validar el bus',
        body: 'Esta versión de la app no está conectada al servidor de Mi bus.',
      };
    case 'network':
      return { title: 'Sin conexión', body: 'No pudimos validar el bus. Revisa tu internet.' };
  }
}
