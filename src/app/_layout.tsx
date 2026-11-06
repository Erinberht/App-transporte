import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TripProvider } from '../state/trip';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TripProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      </TripProvider>
    </SafeAreaProvider>
  );
}
