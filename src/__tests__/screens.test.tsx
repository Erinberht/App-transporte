import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import BusOnMapScreen from '../app/bus-en-el-mapa';
import ShareTripScreen from '../app/compartir';
import ChooseRouteScreen from '../app/elegir-ruta';
import InTripScreen from '../app/en-viaje';
import TripEndScreen from '../app/fin-del-viaje';
import WhereToScreen from '../app/index';
import { liveShare } from '../sharing/liveShare';
import { TripProvider } from '../state/trip';

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
  index: WhereToScreen,
  'elegir-ruta': ChooseRouteScreen,
  'bus-en-el-mapa': BusOnMapScreen,
  compartir: ShareTripScreen,
  'en-viaje': InTripScreen,
  'fin-del-viaje': TripEndScreen,
};

const open = (initialUrl: string) => renderRouter(routes, { initialUrl });

describe('Pantallas del flujo', () => {
  // Compartir el recorrido es un estado global de la app: cada prueba empieza sin compartir.
  beforeEach(() => liveShare.reset());

  it('0 · ¿A dónde vas?: destino único, hora de clase y continuar', async () => {
    await open('/');

    expect(screen.getByText('¿A dónde vas?')).toBeOnTheScreen();
    expect(screen.getByText('Universidad de Córdoba')).toBeOnTheScreen();
    expect(screen.getByText('Sede Montería · campus principal')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.queryByText(/Berástegui/)).not.toBeOnTheScreen();
    expect(screen.getByText('7:00 a. m.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Buscar rutas'));
    expect(screen).toHavePathname('/elegir-ruta');
  });

  it('1 · Elegir ruta: lista las rutas y muestra la seleccionada', async () => {
    await open('/elegir-ruta');

    expect(screen.getByText('Elige tu ruta')).toBeOnTheScreen();
    expect(screen.getByText('10 rutas')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    for (const name of ['6M', 'AE', 'D1', 'M1', 'P1', 'P2', 'P3', 'RG', 'S1', 'T2']) {
      expect(screen.getByText(name)).toBeOnTheScreen();
    }
    expect(screen.getByText('Rancho Grande')).toBeOnTheScreen();
    expect(screen.getByText('Pradera 27')).toBeOnTheScreen();
    expect(screen.getByText('Ruta seleccionada')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { selected: true })).toHaveTextContent(/T2/);
    expect(screen.getByText('Anuncio')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Ver mi bus'));
    expect(screen).toHavePathname('/bus-en-el-mapa');
  });

  it('2 · Esperando tu bus: muestra la llegada y no inventa avisos', async () => {
    await open('/bus-en-el-mapa');

    expect(screen.getByText('Esperando tu bus')).toBeOnTheScreen();
    // La paginación del prototipo ("2 de 5") ya no aparece.
    expect(screen.queryByText(/de 5$/)).not.toBeOnTheScreen();
    expect(screen.getByText('Llega en 5 min')).toBeOnTheScreen();
    // Sin reportes de viajeros no hay avisos, y sin buses compartiendo no dice "En vivo".
    expect(screen.queryByText(/ viajeros? reporta/)).not.toBeOnTheScreen();
    expect(screen.queryByText('En vivo')).not.toBeOnTheScreen();
    expect(
      screen.getByText('Nadie comparte esta ruta ahora · posición estimada'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Recorrido aproximado (datos de prueba)')).toBeOnTheScreen();

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
    expect(
      screen.getByText('Toca una opción para avisar a quienes esperan este bus.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('En la ruta: Sin reportes de cupo recientes')).toBeOnTheScreen();
    expect(screen.queryByText('Anuncio')).not.toBeOnTheScreen();

    // Sin compartir no hay viaje en el servidor: no se puede enviar y lo dice.
    await fireEvent.press(screen.getByText('Lleno'));
    expect(
      await screen.findByText('El cupo se envía solo mientras compartes tu recorrido.'),
    ).toBeOnTheScreen();

    // Se abrió sin pulsar "Compartir": no hay nada que detener.
    expect(screen.getByText('No estás compartiendo')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Continuar'));
    expect(screen).toHavePathname('/fin-del-viaje');
  });

  it('5 · Fin del viaje: resume, no muestra anuncios y vuelve al inicio', async () => {
    await open('/fin-del-viaje');

    expect(screen.getByText('Viaje terminado')).toBeOnTheScreen();
    expect(screen.getByText('No compartiste tu ubicación en este viaje.')).toBeOnTheScreen();
    expect(screen.getByText(/^Llegaste /)).toBeOnTheScreen();
    expect(screen.queryByText('Anuncio')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Listo'));
    expect(screen).toHavePathname('/');
  });

  it('2 · "Buscar otra ruta" (mientras esperas) vuelve a la lista de rutas', async () => {
    await open('/bus-en-el-mapa');

    await fireEvent.press(screen.getByText('Buscar otra ruta'));
    expect(screen).toHavePathname('/elegir-ruta');
  });

  it('recorre el flujo completo con la ruta elegida por el usuario', async () => {
    await open('/');

    await fireEvent.press(screen.getByText('Buscar rutas'));
    await fireEvent.press(screen.getByText('P1'));
    await fireEvent.press(screen.getByText('Ver mi bus'));
    expect(screen.getByText('Ruta P1 · Sigue el recorrido hasta tu parada.')).toBeOnTheScreen();
    expect(screen.getByText('Llega en 9 min')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Ya subí'));
    await fireEvent.press(screen.getByText('Compartir'));
    await fireEvent.press(screen.getByText('Vacío'));
    // Las pruebas no tienen servidor: lo dice en vez de fingir que comparte.
    expect(await screen.findByText('No se está compartiendo')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Continuar'));

    expect(screen).toHavePathname('/fin-del-viaje');
    expect(screen.getByText(/Ruta P1 · terminaste a las/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Listo'));
    expect(screen).toHavePathname('/');
  });
});
