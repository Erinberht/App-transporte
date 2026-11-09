import { act, fireEvent, screen } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import * as transit from '../api/transit';
import BusQrLink from '../app/bus/v1/[code]';
import ShareTripScreen from '../app/compartir';
import InTripScreen from '../app/en-viaje';
import ScanBusScreen, { CONFIRM_MS } from '../app/escanear-qr';
import { liveShare } from '../sharing/liveShare';
import { TripProvider } from '../state/trip';

const BUSES: Record<string, transit.BusInfo> = {
  'PRUEBA-T2-01': { id: 'bus-t2', code: 'PRUEBA-T2-01', routeId: 'T2' },
  'PRUEBA-P3-01': { id: 'bus-p3', code: 'PRUEBA-P3-01', routeId: 'P3' },
};

jest.mock('../api/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('../api/transit', () => ({
  ...jest.requireActual('../api/transit'),
  lookupBus: jest.fn(async (_client: unknown, code: string) => BUSES[code] ?? null),
  startSharedTrip: jest.fn(async () => 'trip-1'),
  endSharedTrip: jest.fn(async () => {}),
  sendTripPosition: jest.fn(async () => {}),
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
  compartir: ShareTripScreen,
  'en-viaje': InTripScreen,
  'escanear-qr': ScanBusScreen,
  'bus/v1/[code]': BusQrLink,
};

async function scan(data: string) {
  await act(async () => {
    screen.getByTestId('camera-view').props.onBarcodeScanned({ type: 'qr', data });
  });
}
/** Hace pasar la confirmación y vuelve a "Compartir" (renderRouter usa reloj simulado). */
const afterConfirmation = () => act(() => jest.advanceTimersByTimeAsync(CONFIRM_MS + 100));

beforeEach(async () => {
  await liveShare.reset();
  jest.clearAllMocks();
});

describe('Escanear el QR del bus', () => {
  it('vincula el bus de la ruta elegida y el viaje se comparte con ese bus', async () => {
    await renderRouter(routes, { initialUrl: '/compartir' });
    await fireEvent.press(screen.getByText('Escanear el QR del bus'));
    expect(screen).toHavePathname('/escanear-qr');
    await scan('mibus://bus/v1/PRUEBA-T2-01');
    expect(await screen.findByText('Bus vinculado')).toBeOnTheScreen();
    expect(screen.getByText('Bus PRUEBA-T2-01 · Ruta T2')).toBeOnTheScreen();

    await afterConfirmation();
    expect(screen).toHavePathname('/compartir');
    expect(screen.getByText('Bus PRUEBA-T2-01')).toBeOnTheScreen();
    expect(screen.getByText('Vinculado · Toca para escanear otro')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Compartir'));
    expect(await screen.findByText(/Bus PRUEBA-T2-01 · Tu recorrido/)).toBeOnTheScreen();
    expect(api.startSharedTrip).toHaveBeenCalledWith(expect.anything(), 'T2', 'bus-t2');
  });

  it('el QR se procesa una sola vez aunque la cámara lo lea muchas veces', async () => {
    await renderRouter(routes, { initialUrl: '/escanear-qr' });
    const camera = screen.getByTestId('camera-view');
    await act(async () => {
      for (let i = 0; i < 5; i++)
        camera.props.onBarcodeScanned({ data: 'mibus://bus/v1/PRUEBA-T2-01' });
    });
    expect(api.lookupBus).toHaveBeenCalledTimes(1);
  });

  it('bus de otra ruta: ofrece cambiar de ruta', async () => {
    await renderRouter(routes, { initialUrl: '/compartir' });
    await fireEvent.press(screen.getByText('Escanear el QR del bus'));
    await scan('mibus://bus/v1/PRUEBA-P3-01');

    expect(await screen.findByText('Este bus es de la ruta P3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Cambiar a P3'));
    expect(await screen.findByText('Bus vinculado')).toBeOnTheScreen();

    await afterConfirmation();
    expect(screen.getByText('¿Subiste al bus P3?')).toBeOnTheScreen();
    expect(screen.getByText('Bus PRUEBA-P3-01')).toBeOnTheScreen();
  });

  it('QR que no es de Mi bus: lo explica y deja escanear otro', async () => {
    await renderRouter(routes, { initialUrl: '/escanear-qr' });
    await scan('https://www.unicordoba.edu.co');

    expect(screen.getByText('Este QR no es de Mi bus')).toBeOnTheScreen();
    expect(api.lookupBus).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Escanear otro'));
    expect(screen.getByTestId('camera-view')).toBeOnTheScreen();
  });

  it('bus no registrado: se puede seguir sin escanear', async () => {
    await renderRouter(routes, { initialUrl: '/compartir' });
    await fireEvent.press(screen.getByText('Escanear el QR del bus'));
    await scan('mibus://bus/v1/NO-EXISTE');

    expect(await screen.findByText('Bus no registrado')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Seguir sin escanear'));
    expect(screen).toHavePathname('/compartir');
    expect(screen.getByText('Escanear el QR del bus')).toBeOnTheScreen();
  });

  it('sin permiso de cámara explica para qué es y lo pide', async () => {
    const request = jest.fn();
    jest
      .mocked(useCameraPermissions)
      .mockReturnValue([
        { granted: false, status: 'undetermined', canAskAgain: true, expires: 'never' },
        request,
        jest.fn(),
      ] as never);

    await renderRouter(routes, { initialUrl: '/escanear-qr' });
    expect(screen.getByText(/No se toman ni se guardan fotos/)).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-view')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Permitir cámara'));
    expect(request).toHaveBeenCalled();
    jest.mocked(useCameraPermissions).mockRestore?.();
  });

  it('el enlace mibus://bus/v1/<código> (cámara normal del teléfono) abre y valida el bus', async () => {
    jest
      .mocked(useCameraPermissions)
      .mockReturnValue([
        { granted: true, status: 'granted', canAskAgain: true, expires: 'never' },
        jest.fn(),
        jest.fn(),
      ] as never);
    await renderRouter(routes, { initialUrl: '/bus/v1/PRUEBA-T2-01' });

    expect(await screen.findByText('Bus vinculado')).toBeOnTheScreen();
    expect(api.lookupBus).toHaveBeenCalledWith(expect.anything(), 'PRUEBA-T2-01');
    await afterConfirmation();
    expect(screen).toHavePathname('/compartir');
    expect(screen.getByText('Bus PRUEBA-T2-01')).toBeOnTheScreen();
  });
});
