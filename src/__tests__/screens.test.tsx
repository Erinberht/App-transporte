import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import ArrivalAlertScreen from '../app/alerta-llegada';
import BusOnMapScreen from '../app/bus-en-el-mapa';
import ShareTripScreen from '../app/compartir';
import InTripScreen from '../app/en-viaje';
import ChooseRouteScreen from '../app/index';
import { TripProvider } from '../state/trip';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Layout de prueba: igual al real pero sin esperar la carga de fuentes.
function TestLayout() {
  return (
    <TripProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </TripProvider>
  );
}

const routes = {
  _layout: TestLayout,
  index: ChooseRouteScreen,
  'bus-en-el-mapa': BusOnMapScreen,
  compartir: ShareTripScreen,
  'en-viaje': InTripScreen,
  'alerta-llegada': ArrivalAlertScreen,
};

const open = (initialUrl: string) => renderRouter(routes, { initialUrl });

describe('Pantallas del flujo', () => {
  it('1 · Elegir ruta: lista las rutas y muestra la seleccionada', async () => {
    await open('/');

    expect(screen.getByText('Elige tu ruta')).toBeOnTheScreen();
    expect(screen.getByText('4 rutas')).toBeOnTheScreen();
    for (const name of ['P1', 'P2', 'T2', 'Rancho Grande']) {
      expect(screen.getByText(name)).toBeOnTheScreen();
    }
    expect(screen.getByText('Ruta seleccionada')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { selected: true })).toHaveTextContent(/T2/);
    expect(screen.getByText('Anuncio')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Ver mi bus'));
    expect(screen).toHavePathname('/bus-en-el-mapa');
  });

  it('2 · Bus en el mapa: muestra la llegada y el aviso de otra ruta', async () => {
    await open('/bus-en-el-mapa');

    expect(screen.getByText('Tu bus en el mapa')).toBeOnTheScreen();
    expect(screen.getByText('Llega en 5 min')).toBeOnTheScreen();
    expect(screen.getByText('Rancho Grande: sin reportes')).toBeOnTheScreen();
    expect(screen.getByText('En vivo')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Ya subí'));
    expect(screen).toHavePathname('/compartir');
  });

  it('3 · Compartir: explica la privacidad y ofrece el QR opcional', async () => {
    await open('/compartir');

    expect(screen.getByText('¿Subiste al bus T2?')).toBeOnTheScreen();
    expect(screen.getByText('Escanear el QR del bus')).toBeOnTheScreen();
    expect(screen.getByText(/Solo durante tu viaje/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Compartir'));
    expect(screen).toHavePathname('/en-viaje');
  });

  it('4 · En viaje: permite reportar el cupo y no muestra anuncios', async () => {
    await open('/en-viaje');

    expect(screen.getByText('Estás en viaje')).toBeOnTheScreen();
    expect(screen.getByText('Cupo medio seleccionado')).toBeOnTheScreen();
    expect(screen.queryByText('Anuncio')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Lleno'));
    expect(screen.getByText('Cupo lleno seleccionado')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Dejar de compartir'));
    expect(screen).toHavePathname('/alerta-llegada');
  });

  it('5 · Alerta de llegada: muestra el tiempo, el cupo y vuelve al inicio', async () => {
    await open('/alerta-llegada');

    expect(screen.getByText('Tu bus está cerca')).toBeOnTheScreen();
    expect(screen.getByText('Tu bus llega en 5 min')).toBeOnTheScreen();
    expect(screen.getByText('Cupo: medio')).toBeOnTheScreen();
    expect(screen.getByText('Anuncio')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Fin'));
    expect(screen).toHavePathname('/');
  });

  it('recorre el flujo completo con la ruta elegida por el usuario', async () => {
    await open('/');

    await fireEvent.press(screen.getByText('P1'));
    await fireEvent.press(screen.getByText('Ver mi bus'));
    expect(screen.getByText('Ruta P1 · Sigue el recorrido hasta tu parada.')).toBeOnTheScreen();
    expect(screen.getByText('Llega en 9 min')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Ya subí'));
    await fireEvent.press(screen.getByText('Compartir'));
    await fireEvent.press(screen.getByText('Vacío'));
    await fireEvent.press(screen.getByText('Dejar de compartir'));

    expect(screen.getByText('Cupo: vacío')).toBeOnTheScreen();
    expect(screen.getByText('Alerta de llegada · P1')).toBeOnTheScreen();
  });
});
