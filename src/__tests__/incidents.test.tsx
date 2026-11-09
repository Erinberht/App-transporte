import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import * as transit from '../api/transit';
import BusOnMapScreen from '../app/bus-en-el-mapa';
import ShareTripScreen from '../app/compartir';
import ChooseRouteScreen from '../app/elegir-ruta';
import InTripScreen from '../app/en-viaje';
import WhereToScreen from '../app/index';
import { liveShare } from '../sharing/liveShare';
import { TripProvider } from '../state/trip';

jest.mock('../api/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('../api/transit', () => ({
  ...jest.requireActual('../api/transit'),
  startSharedTrip: jest.fn(async () => 'trip-1'),
  endSharedTrip: jest.fn(async () => {}),
  sendTripPosition: jest.fn(async () => {}),
  reportIncident: jest.fn(async () => {}),
  fetchRouteLiveBuses: jest.fn(async () => []),
  fetchLiveOccupancy: jest.fn(async () => ({ byRoute: {}, byBus: {} })),
  fetchLiveIncidents: jest.fn(async () => []),
}));
const api = jest.mocked(transit);

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
};

async function openWithLocation() {
  await renderRouter(routes, { initialUrl: '/' });
  await fireEvent.press(screen.getByText('Permitir ubicación'));
  await screen.findByText('Ubicación actual detectada');
  await fireEvent.press(screen.getByText('Buscar rutas'));
}

/** Nombre corto de la ruta de una opción de la lista ("Ruta P3, Pradera 3. ..."). */
const routeOf = (radio: { props: { accessibilityLabel?: string } }) =>
  /^Ruta (\S+),/.exec(radio.props.accessibilityLabel ?? '')?.[1];

beforeEach(async () => {
  // Lunes 9 de noviembre de 2026, 6:15 a. m. (clase por defecto: 7:00 a. m.).
  jest.useFakeTimers({ now: new Date(2026, 10, 9, 6, 15), advanceTimers: true });
  await liveShare.reset();
  jest.clearAllMocks();
  api.fetchLiveIncidents.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

describe('Buseta varada o desviada', () => {
  it('la lista avisa y no recomienda la ruta varada; al esperarla sugiere otra', async () => {
    // Con los datos de prueba, desde el centro a las 6:15 la recomendada es la P3.
    const top = 'P3';
    api.fetchLiveIncidents.mockResolvedValue([
      {
        routeId: top,
        kind: 'broken_down',
        reports: 2,
        at: new Date(Date.now() - 4 * 60_000),
        location: null,
        nearStop: 'Calle 22',
      },
    ]);
    await openWithLocation();
    expect(screen.getByText(/^P3$/)).toBeOnTheScreen();
    const warning = `⚠ La ${top} se varó cerca de Calle 22 · hace 4 min · 2 viajeros reportan`;
    expect(await screen.findByText(warning)).toBeOnTheScreen();
    const selected = screen.getByRole('radio', { selected: true });
    expect(routeOf(selected)).not.toBe(top);

    // El usuario igual elige la ruta varada y va a esperarla.
    const radios = screen.getAllByRole('radio');
    await fireEvent.press(radios.find((r) => routeOf(r) === top)!);
    await fireEvent.press(screen.getByText('Ver mi bus'));

    expect(
      await screen.findByText('La P3 se varó cerca de Calle 22 · hace 4 min · 2 viajeros reportan'),
    ).toBeOnTheScreen();
    const alt = await screen.findByText(/^Mejor alternativa: ruta /);
    const altRoute = /ruta (\S+)$/.exec(
      String(alt.props.children.join?.('') ?? alt.props.children),
    )?.[1];
    expect(altRoute).toBeTruthy();
    expect(altRoute).not.toBe(top);

    await fireEvent.press(screen.getByText(`Cambiar a ${altRoute}`));
    expect(screen.getByText(new RegExp(`^Ruta ${altRoute} · Súbete en `))).toBeOnTheScreen();
  });

  it('en viaje, quien va en el bus reporta que se varó', async () => {
    await renderRouter(routes, { initialUrl: '/compartir' });
    await fireEvent.press(screen.getByText('Compartir'));
    expect(await screen.findByText('¿Pasa algo con el bus?')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Se varó'));
    expect(
      await screen.findByText(
        'Gracias. Avisamos a quienes esperan la T2 y les sugerimos otra ruta.',
      ),
    ).toBeOnTheScreen();
    expect(api.reportIncident).toHaveBeenCalledWith(
      expect.anything(),
      'trip-1',
      'T2',
      'broken_down',
    );

    await fireEvent.press(screen.getByText('Se varó'));
    expect(await screen.findByText('Ya lo reportaste en este viaje.')).toBeOnTheScreen();
    expect(api.reportIncident).toHaveBeenCalledTimes(1);
  });

  it('sin compartir no muestra los botones de reporte', async () => {
    await renderRouter(routes, { initialUrl: '/en-viaje' });
    expect(screen.queryByText('¿Pasa algo con el bus?')).not.toBeOnTheScreen();
  });
});
