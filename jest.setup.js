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
}));

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
