// Mocks globales para módulos nativos que no existen en el entorno de Jest.

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// react-native-maps: componentes simples con testID para poder inspeccionarlos.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = React.forwardRef(function MockMapView(props, ref) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
    return React.createElement(View, { ...props, testID: 'map-view' });
  });
  const Marker = (props) => React.createElement(View, { ...props, testID: 'map-marker' });
  const Polyline = (props) => React.createElement(View, { ...props, testID: 'map-polyline' });
  return { __esModule: true, default: MapView, Marker, Polyline };
});

// expo-network: con conexión por defecto; cada test puede cambiar el valor devuelto.
jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

// expo-location: permiso aún sin decidir; al pedirlo se concede y devuelve un punto de
// Montería. Cada test puede cambiar las respuestas con mockResolvedValueOnce.
jest.mock('expo-location', () => ({
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
  getForegroundPermissionsAsync: jest.fn(async () => ({
    status: 'undetermined',
    granted: false,
    canAskAgain: true,
  })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 8.759, longitude: -75.879, accuracy: 35 },
    timestamp: 0,
  })),
  // Compartir el recorrido: sin permiso "todo el tiempo" (solo con la app abierta).
  ActivityType: { Other: 1, AutomotiveNavigation: 2, Fitness: 3, OtherNavigation: 4, Airborne: 5 },
  getBackgroundPermissionsAsync: jest.fn(async () => ({
    status: 'denied',
    granted: false,
    canAskAgain: false,
  })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({
    status: 'denied',
    granted: false,
    canAskAgain: false,
  })),
  startLocationUpdatesAsync: jest.fn(async () => {}),
  stopLocationUpdatesAsync: jest.fn(async () => {}),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
}));

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));

// Selector de hora: componente simple (iOS) y apertura imperativa (Android).
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  const DateTimePicker = (props) => React.createElement(View, { ...props, testID: 'time-picker' });
  return {
    __esModule: true,
    default: DateTimePicker,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

// expo-sqlite: almacenamiento clave-valor en memoria y shim de localStorage sin efecto.
jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('expo-sqlite/kv-store', () => {
  const data = new Map();
  const storage = {
    getItemSync: jest.fn((key) => (data.has(key) ? data.get(key) : null)),
    setItemSync: jest.fn((key, value) => void data.set(key, value)),
    removeItemSync: jest.fn((key) => data.delete(key)),
    getItemAsync: jest.fn(async (key) => (data.has(key) ? data.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => void data.set(key, value)),
    removeItemAsync: jest.fn(async (key) => data.delete(key)),
    clearSync: jest.fn(() => data.clear()),
  };
  return { __esModule: true, default: storage };
});
