import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Linking, Text } from 'react-native';

import WhereToScreen from '../app/index';
import { TripProvider, useTrip } from '../state/trip';

const mocked = jest.mocked(Location);

// Muestra el origen guardado en el estado del viaje, para comprobar que se actualiza.
function OriginProbe() {
  const { origin } = useTrip();
  return <Text>{origin ? `origen:${origin.latitude},${origin.longitude}` : 'sin origen'}</Text>;
}

const renderScreen = () =>
  render(
    <TripProvider>
      <WhereToScreen />
      <OriginProbe />
    </TripProvider>,
  );

describe('Ubicación en "¿A dónde vas?"', () => {
  afterEach(() => jest.clearAllMocks());

  it('explica el uso antes de pedir permiso y no lo pide por sí sola', async () => {
    await renderScreen();

    expect(screen.getByText('Usar mi ubicación actual')).toBeOnTheScreen();
    expect(screen.getByText(/se queda en tu teléfono/)).toBeOnTheScreen();
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(screen.getByText('sin origen')).toBeOnTheScreen();
  });

  it('al permitir, obtiene la ubicación y la guarda como origen del viaje', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText('Permitir ubicación'));

    expect(await screen.findByText('Ubicación actual detectada')).toBeOnTheScreen();
    expect(screen.getByText('Precisión aproximada: 35 m.')).toBeOnTheScreen();
    expect(screen.getByText('origen:8.759,-75.879')).toBeOnTheScreen();
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.Balanced,
    });
  });

  it('si ya había permiso, ubica sin volver a preguntar', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'granted' as never,
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });

    await renderScreen();

    expect(await screen.findByText('Ubicación actual detectada')).toBeOnTheScreen();
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('si niega el permiso, permite continuar e intentar de nuevo', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'denied' as never,
      granted: false,
      canAskAgain: true,
      expires: 'never',
    });
    await renderScreen();

    await fireEvent.press(screen.getByText('Permitir ubicación'));

    expect(await screen.findByText('Sin permiso de ubicación')).toBeOnTheScreen();
    expect(screen.getByText('Intentar de nuevo')).toBeOnTheScreen();
    expect(screen.getByText('Buscar rutas')).toBeOnTheScreen();
    expect(screen.getByText('sin origen')).toBeOnTheScreen();
  });

  it('si el permiso quedó bloqueado, ofrece abrir los ajustes', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'denied' as never,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderScreen();

    await fireEvent.press(screen.getByText('Permitir ubicación'));
    await fireEvent.press(await screen.findByText('Abrir ajustes'));

    expect(openSettings).toHaveBeenCalled();
  });

  it('avisa si el GPS del teléfono está apagado', async () => {
    mocked.hasServicesEnabledAsync.mockResolvedValueOnce(false);
    await renderScreen();

    await fireEvent.press(screen.getByText('Permitir ubicación'));

    expect(await screen.findByText('La ubicación del teléfono está apagada')).toBeOnTheScreen();
  });
});
