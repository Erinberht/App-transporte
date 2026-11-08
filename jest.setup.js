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
