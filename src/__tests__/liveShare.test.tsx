import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import * as transit from '../api/transit';
import BusOnMapScreen from '../app/bus-en-el-mapa';
import ChooseRouteScreen from '../app/elegir-ruta';
import ShareTripScreen from '../app/compartir';
import InTripScreen from '../app/en-viaje';
import TripEndScreen from '../app/fin-del-viaje';
import { liveShare } from '../sharing/liveShare';
import { TripProvider } from '../state/trip';

// Backend "configurado" con las llamadas simuladas.
jest.mock('../api/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('../api/transit', () => ({
  ...jest.requireActual('../api/transit'),
  startSharedTrip: jest.fn(async () => 'trip-1'),
  endSharedTrip: jest.fn(async () => {}),
  sendTripPosition: jest.fn(async () => {}),
  fetchRouteLiveBuses: jest.fn(async () => []),
  reportOccupancy: jest.fn(async () => {}),
  fetchLiveOccupancy: jest.fn(async () => ({ byRoute: {}, byBus: {} })),
}));
const api = jest.mocked(transit);
const location = jest.mocked(Location);

function TestLayout() {
  return (
    <TripProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </TripProvider>
  );
}
const routes = {
  _layout: TestLayout,
  'bus-en-el-mapa': BusOnMapScreen,
  'elegir-ruta': ChooseRouteScreen,
  compartir: ShareTripScreen,
  'en-viaje': InTripScreen,
  'fin-del-viaje': TripEndScreen,
};

beforeEach(async () => {
  await liveShare.reset();
  jest.clearAllMocks();
});

describe('Compartir mi recorrido', () => {
  it('comparte, envía la posición y se detiene con "Dejar de compartir"', async () => {
    let onLocation: (l: Location.LocationObject) => void = () => {};
    const remove = jest.fn();
    location.watchPositionAsync.mockImplementationOnce(async (_options, cb) => {
      onLocation = cb;
      return { remove };
    });

    await renderRouter(routes, { initialUrl: '/compartir' });
    expect(screen.getByText(/Permitir todo el tiempo/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Compartir'));

    expect(screen).toHavePathname('/en-viaje');
    expect(await screen.findByText('Compartiendo tu recorrido en vivo')).toBeOnTheScreen();
    // El mock no da permiso "todo el tiempo": comparte solo con la app abierta.
    expect(screen.getByText(/Mantén la app abierta/)).toBeOnTheScreen();
    expect(api.startSharedTrip).toHaveBeenCalledWith(expect.anything(), 'T2', null);

    await act(async () => {
      onLocation({
        coords: {
          latitude: 8.76,
          longitude: -75.88,
          speed: 7,
          accuracy: 12,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
        },
        timestamp: Date.now(),
      });
    });
    expect(api.sendTripPosition).toHaveBeenCalledWith(
      expect.anything(),
      'trip-1',
      expect.objectContaining({ latitude: 8.76, longitude: -75.88, speedMps: 7, accuracyM: 12 }),
    );
    expect(await screen.findByText(/Último envío hace \d+ s/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Dejar de compartir'));
    expect(screen).toHavePathname('/fin-del-viaje');
    expect(
      screen.getByText(/^Compartiste \d+ min\. Tu ubicación ya no se envía\.$/),
    ).toBeOnTheScreen();
    expect(remove).toHaveBeenCalled();
    expect(api.endSharedTrip).toHaveBeenCalledWith(expect.anything(), 'trip-1', 'user');
  });

  it('sin permiso de ubicación lo explica y ofrece abrir los ajustes', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    } as Location.LocationPermissionResponse);

    await renderRouter(routes, { initialUrl: '/compartir' });
    await fireEvent.press(screen.getByText('Compartir'));

    expect(await screen.findByText('Falta el permiso de ubicación')).toBeOnTheScreen();
    expect(screen.getByText('Abrir ajustes')).toBeOnTheScreen();
    expect(screen.getByText('Continuar')).toBeOnTheScreen();
    expect(api.startSharedTrip).not.toHaveBeenCalled();
  });

  it('"Bus en el mapa" dibuja los buses en vivo de la ruta', async () => {
    api.fetchRouteLiveBuses.mockResolvedValue([
      { latitude: 8.75, longitude: -75.88, travelers: 2, at: new Date() },
      { latitude: 8.77, longitude: -75.87, travelers: 1, at: new Date() },
    ]);

    await renderRouter(routes, { initialUrl: '/bus-en-el-mapa' });

    expect(await screen.findByText('Posición en vivo · 3 viajeros comparten')).toBeOnTheScreen();
    expect(api.fetchRouteLiveBuses).toHaveBeenCalledWith(expect.anything(), 'T2');
    const live = screen
      .getAllByTestId('map-marker')
      .filter((m) => m.props.title === 'Bus T2 en vivo');
    expect(live.map((m) => m.props.coordinate)).toEqual([
      { latitude: 8.75, longitude: -75.88 },
      { latitude: 8.77, longitude: -75.87 },
    ]);
  });

  it('"Bus en el mapa" sin viajeros dice que la posición es estimada', async () => {
    api.fetchRouteLiveBuses.mockResolvedValue([]);
    await renderRouter(routes, { initialUrl: '/bus-en-el-mapa' });
    expect(
      await screen.findByText('Nadie comparte esta ruta ahora · posición estimada'),
    ).toBeOnTheScreen();
  });

  it('en viaje, el cupo se envía al servidor y respeta el límite de 2 minutos', async () => {
    await renderRouter(routes, { initialUrl: '/compartir' });
    await fireEvent.press(screen.getByText('Compartir'));
    expect(await screen.findByText('Compartiendo tu recorrido en vivo')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Lleno'));
    expect(await screen.findByText('Enviado. Lo verán quienes esperan la T2.')).toBeOnTheScreen();
    expect(api.reportOccupancy).toHaveBeenCalledWith(expect.anything(), 'trip-1', 'T2', 'full');
    expect(screen.getByRole('radio', { selected: true })).toHaveTextContent('Lleno');

    await fireEvent.press(screen.getByText('Vacío'));
    expect(
      await screen.findByText('Ya reportaste hace poco. Podrás actualizarlo en 2 min.'),
    ).toBeOnTheScreen();
    expect(api.reportOccupancy).toHaveBeenCalledTimes(1);
    // Sigue marcado lo último que sí se envió.
    expect(screen.getByRole('radio', { selected: true })).toHaveTextContent('Lleno');
  });

  it('el cupo de los viajeros aparece al esperar el bus y en la lista de rutas', async () => {
    const at = new Date(Date.now() - 3 * 60_000);
    api.fetchLiveOccupancy.mockResolvedValue({
      byRoute: { T2: { level: 'full', reports: 2, at }, P3: { level: 'empty', reports: 1, at } },
      byBus: {},
    });

    await renderRouter(routes, { initialUrl: '/bus-en-el-mapa' });
    expect(await screen.findByText('Cupo lleno · hace 3 min · 2 viajeros')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Buscar otra ruta'));
    expect(await screen.findByText('Cupo vacío · hace 3 min · 1 viajero')).toBeOnTheScreen();
    expect(screen.getByText('Cupo lleno · hace 3 min · 2 viajeros')).toBeOnTheScreen();
  });
});
