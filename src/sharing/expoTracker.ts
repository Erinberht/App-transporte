// GPS real con expo-location. Con permiso "todo el tiempo" usa una tarea en segundo plano
// (servicio con notificación fija en Android) para seguir con la pantalla apagada; si no,
// solo lee mientras la app está abierta.
// Docs: https://docs.expo.dev/versions/v58.0.0/sdk/location/
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { colors } from '../theme';
import type { LocationSample } from './alighting';
import type { LocationTracker } from './shareSession';

export const SHARE_TASK = 'mi-bus-compartir-recorrido';

/** Lecturas cada 10 s con GPS: con menos precisión no se distingue si sigues en el bus. */
const OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 10_000,
  distanceInterval: 0,
};

let listener: ((samples: LocationSample[]) => void) | null = null;
let subscription: Location.LocationSubscription | null = null;

export function toSample(location: Location.LocationObject): LocationSample {
  return {
    coordinate: { latitude: location.coords.latitude, longitude: location.coords.longitude },
    timestamp: location.timestamp,
    speedMps: location.coords.speed ?? null,
    accuracy: location.coords.accuracy ?? null,
  };
}

async function stopBackground() {
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(SHARE_TASK)) {
    await Location.stopLocationUpdatesAsync(SHARE_TASK);
  }
}

// La tarea se define al cargar el módulo (lo importa src/app/_layout.tsx), como piden los docs.
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    SHARE_TASK,
    async ({ data, error }) => {
      if (error || !data) return;
      if (!listener) {
        // Nadie está compartiendo en esta sesión de la app: apagar el GPS.
        await stopBackground().catch(() => {});
        return;
      }
      listener(data.locations.map(toSample));
    },
  );
}

export const expoTracker: LocationTracker = {
  async requestPermission() {
    if (!(await Location.hasServicesEnabledAsync())) return 'services_off';
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) return 'denied';
    if (Platform.OS === 'web') return 'foreground';
    let background = await Location.getBackgroundPermissionsAsync();
    if (!background.granted && background.canAskAgain) {
      // En Android 11+ abre los ajustes: la pantalla "Compartir" ya explica qué elegir.
      background = await Location.requestBackgroundPermissionsAsync();
    }
    return background.granted ? 'background' : 'foreground';
  },

  async start(mode, label, onSamples) {
    await this.stop();
    listener = onSamples;
    if (mode === 'background') {
      await Location.startLocationUpdatesAsync(SHARE_TASK, {
        ...OPTIONS,
        activityType: Location.ActivityType.OtherNavigation,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Compartiendo tu recorrido',
          notificationBody: `${label}. Abre Mi bus para dejar de compartir.`,
          notificationColor: colors.success,
          killServiceOnDestroy: true,
        },
      });
    } else {
      subscription = await Location.watchPositionAsync(OPTIONS, (location) =>
        listener?.([toSample(location)]),
      );
    }
  },

  async stop() {
    listener = null;
    subscription?.remove();
    subscription = null;
    await stopBackground();
  },
};
