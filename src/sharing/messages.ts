// Textos del estado de "Compartir mi recorrido" para la pantalla "En viaje".
import type { ShareStatus } from './shareSession';

export type ShareTone = 'success' | 'warning' | 'danger' | 'muted';

export type ShareMessage = {
  tone: ShareTone;
  title: string;
  body: string;
  /** Acción para salir de un error. */
  action?: 'retry' | 'settings';
};

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.floor(s / 60)} min`;
}

export function shareMessage(status: ShareStatus, now: number): ShareMessage {
  switch (status.state) {
    case 'idle':
      return { tone: 'muted', title: 'No estás compartiendo', body: 'Tu ubicación no se envía.' };
    case 'starting':
      return { tone: 'muted', title: 'Conectando…', body: 'Preparando tu recorrido.' };
    case 'sharing': {
      const keepOpen =
        status.mode === 'foreground' ? ' Mantén la app abierta para seguir compartiendo.' : '';
      if (status.sendFailing) {
        return {
          tone: 'warning',
          title: 'Sin señal',
          body: `Reintentamos con tu próxima ubicación.${keepOpen}`,
        };
      }
      return {
        tone: 'success',
        title: 'Compartiendo tu recorrido en vivo',
        body:
          (status.lastSentAt === null
            ? 'Enviando tu primera ubicación…'
            : `Último envío ${ago(now - status.lastSentAt)}.`) + keepOpen,
      };
    }
    case 'ended':
      if (status.reason === 'auto_alighted') {
        return {
          tone: 'muted',
          title: 'Bajaste del bus',
          body: 'Lo detectamos y dejamos de compartir tu ubicación.',
        };
      }
      if (status.reason === 'timeout') {
        return {
          tone: 'muted',
          title: 'Dejamos de compartir',
          body: 'El viaje superó el tiempo máximo o estuvo mucho rato sin señal.',
        };
      }
      return { tone: 'muted', title: 'Dejaste de compartir', body: 'Tu ubicación ya no se envía.' };
    case 'error':
      switch (status.error) {
        case 'no_backend':
          return {
            tone: 'danger',
            title: 'No se está compartiendo',
            body: 'Esta versión de la app no está conectada al servidor de Mi bus.',
          };
        case 'permission':
          return {
            tone: 'danger',
            title: 'Falta el permiso de ubicación',
            body: 'Sin él no podemos compartir tu recorrido. Actívalo en los ajustes del teléfono.',
            action: 'settings',
          };
        case 'location_off':
          return {
            tone: 'danger',
            title: 'El GPS está apagado',
            body: 'Actívalo para compartir tu recorrido.',
            action: 'retry',
          };
        case 'network':
          return {
            tone: 'danger',
            title: 'Sin conexión',
            body: 'No pudimos conectar con el servidor. Revisa tu internet.',
            action: 'retry',
          };
      }
  }
}
