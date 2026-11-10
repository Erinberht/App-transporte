// Programa los avisos locales con expo-notifications (etapa 4.2a). Todo ocurre en el teléfono:
// no hay token de push ni servidor (el push de incidentes queda para la 4.2b).
// Sin permiso de alarmas exactas, Android entrega los avisos a una hora aproximada.
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { routesRepository } from '../data/repository';
import { profileStore } from '../profile/store';
import { planDailyNotices, type Notice } from './plan';

export const CHANNEL_ID = 'avisos';
const DAILY_PREFIX = /^(morning|departure):/;

const supported = Platform.OS === 'android' || Platform.OS === 'ios';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Avisos de viaje',
    description: 'Hora de salir a clase y llegada de tu bus',
    importance: AndroidImportance.HIGH,
  });
}

async function hasPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted;
}

/** Pide el permiso de notificaciones (al activar un aviso). true si quedó concedido. */
export async function requestNoticePermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    // En Android 13+ el diálogo solo aparece si ya existe un canal.
    await ensureChannel();
    if (await hasPermission()) return true;
    const result = await Notifications.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

async function schedule(notice: Notice) {
  await Notifications.scheduleNotificationAsync({
    identifier: notice.id,
    content: { title: notice.title, body: notice.body, data: { kind: notice.kind } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notice.fireAt,
      channelId: CHANNEL_ID,
    },
  });
}

async function cancelDaily() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => DAILY_PREFIX.test(n.identifier))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Reemplaza los avisos de la mañana y de salida por los que tocan según el perfil de hoy. */
export async function syncDailyNotices(now = new Date()): Promise<number> {
  if (!supported) return 0;
  const notices = planDailyNotices({
    profile: profileStore.get(),
    repo: routesRepository,
    now,
    routeName: (id) => routesRepository.getRoute(id)?.shortName ?? id,
  });
  await cancelDaily();
  if (notices.length === 0 || !(await hasPermission())) return 0;
  await ensureChannel();
  for (const notice of notices) await schedule(notice);
  return notices.length;
}

/** Programa (o reprograma) la alerta de llegada del bus. null la cancela. */
export async function setArrivalNotice(notice: Notice | null): Promise<void> {
  if (!supported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync('arrival');
    if (!notice || !profileStore.get().notices.arrival || !(await hasPermission())) return;
    await ensureChannel();
    await schedule(notice);
  } catch {
    // Un aviso que no se pudo programar no debe romper la pantalla.
  }
}

let chain: Promise<unknown> = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Encola una sincronización (en serie, para que dos no se pisen). */
function requestSync(delayMs = 800) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    chain = chain.then(() => syncDailyNotices()).catch(() => {});
  }, delayMs);
}

let started = false;

/**
 * Al arrancar la app: muestra los avisos también con la app abierta, sincroniza ahora, cada
 * vez que cambia el perfil y al volver a la app (para mover la ventana de 7 días).
 */
export function startNotificationSync() {
  if (!supported || started) return;
  started = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  requestSync(0);
  profileStore.subscribe(() => requestSync());
  AppState.addEventListener('change', (state) => {
    if (state === 'active') requestSync();
  });
}
