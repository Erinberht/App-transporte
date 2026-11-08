import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadCachedDataset, refreshDataset } from '../data/transitSync';
// Define la tarea de ubicación en segundo plano al cargar la app (expo-task-manager lo exige).
import '../sharing/expoTracker';
import { TripProvider } from '../state/trip';

// Mantener el splash hasta que carguen las fuentes del diseño (Inter).
SplashScreen.preventAutoHideAsync();

// Rutas: usar la copia guardada en el teléfono si es más nueva que la incluida en la app.
// Es síncrono y ocurre antes de mostrar cualquier pantalla.
loadCachedDataset();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // Descarga el catálogo del backend (si está configurado) para el próximo arranque.
  useEffect(() => {
    refreshDataset();
  }, []);

  // Si falla la carga de fuentes se continúa con la fuente del sistema.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <TripProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      </TripProvider>
    </SafeAreaProvider>
  );
}
