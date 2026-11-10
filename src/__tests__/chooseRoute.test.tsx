import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import BusOnMapScreen from '../app/bus-en-el-mapa';
import ChooseRouteScreen from '../app/elegir-ruta';
import { classArrivalText } from '../app/fin-del-viaje';
import WhereToScreen from '../app/index';
import { TripProvider } from '../state/trip';

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
};

// "¿A dónde vas?" → permitir ubicación (el mock da un punto del centro de Montería) → rutas.
async function openWithLocation() {
  await renderRouter(routes, { initialUrl: '/' });
  await fireEvent.press(screen.getByText('Permitir ubicación'));
  await screen.findByText('Ubicación actual detectada');
  await fireEvent.press(screen.getByText('Buscar rutas'));
}

const LABEL = /^(Llegas \d+ min antes|Llegas justo|Llegas tarde · \d+ min)$/;

describe('Elegir ruta con recomendación', () => {
  beforeEach(() => {
    // Lunes 9 de noviembre de 2026, 6:15 a. m. (clase por defecto: 7:00 a. m.).
    jest.useFakeTimers({ now: new Date(2026, 10, 9, 6, 15), advanceTimers: true });
  });
  afterEach(() => jest.useRealTimers());

  it('sin ubicación pide activarla y no inventa tiempos', async () => {
    await renderRouter(routes, { initialUrl: '/elegir-ruta' });

    expect(screen.getByText(/Activa tu ubicación para ver a qué hora llegas/)).toBeOnTheScreen();
    expect(screen.queryByText(LABEL)).not.toBeOnTheScreen();
    expect(screen.getByText('10 rutas')).toBeOnTheScreen();
  });

  it('con ubicación ordena las rutas, muestra la llegada y preselecciona la mejor', async () => {
    await openWithLocation();

    expect(screen).toHavePathname('/elegir-ruta');
    expect(screen.getByText('Para tu clase de las 7:00 a. m.')).toBeOnTheScreen();
    expect(screen.queryByText(/Activa tu ubicación/)).not.toBeOnTheScreen();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(10);
    // La primera es la recomendada y queda seleccionada.
    expect(radios[0].props.accessibilityState).toEqual({ selected: true });
    expect(radios[0].props.accessibilityLabel).toMatch(/Llegas (\d+ min antes|justo)/);

    const labels = screen.getAllByText(LABEL);
    expect(labels.length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/^Sube en .+ a las \d+:\d\d [ap]\. m\. · llegas \d+:\d\d/).length,
    ).toBe(labels.length);
  });

  it('respeta la ruta que el usuario elige', async () => {
    await openWithLocation();

    const last = screen.getAllByRole('radio')[9];
    await fireEvent.press(last);

    expect(screen.getAllByRole('radio')[9].props.accessibilityState).toEqual({ selected: true });
    expect(screen.getAllByRole('radio')[0].props.accessibilityState).toEqual({ selected: false });
  });

  it('al esperar el bus muestra cuándo pasa y si así llegas a tiempo', async () => {
    await openWithLocation();
    await fireEvent.press(screen.getByText('Ver mi bus'));

    expect(screen).toHavePathname('/bus-en-el-mapa');
    expect(screen.getByText('Esperando tu bus')).toBeOnTheScreen();
    expect(screen.getByText(/^Ruta .+ · Súbete en .+\.$/)).toBeOnTheScreen();
    expect(screen.getByText(/^Pasa a las \d+:\d\d [ap]\. m\. · llegas /)).toBeOnTheScreen();
    expect(screen.getByText(LABEL)).toBeOnTheScreen();
    expect(screen.getByText(/^(Llega en \d+ min|Está llegando)$/)).toBeOnTheScreen();
  });

  it('si con la ruta elegida llegas tarde, lo avisa al esperar', async () => {
    await openWithLocation();
    // La última de la lista es la que llega más tarde (AE con los datos de prueba).
    await fireEvent.press(screen.getAllByRole('radio')[9]);
    await fireEvent.press(screen.getByText('Ver mi bus'));

    const late = screen.queryByText(/Con este bus llegas tarde a tu clase de las 7:00 a\. m\./);
    expect(screen.getByText(LABEL)).toHaveTextContent(/^Llegas tarde/);
    expect(late).toBeOnTheScreen();
  });
});

describe('classArrivalText', () => {
  const clase = new Date(2026, 10, 9, 7, 0);
  it.each([
    [new Date(2026, 10, 9, 6, 52), 'Llegaste 8 min antes de tu clase de las 7:00 a. m.'],
    [new Date(2026, 10, 9, 7, 0), 'Llegaste justo a tiempo a tu clase de las 7:00 a. m.'],
    [new Date(2026, 10, 9, 7, 5), 'Llegaste 5 min tarde a tu clase de las 7:00 a. m.'],
    [new Date(2026, 10, 9, 13, 30), 'Llegaste a las 1:30 p. m.'],
  ])('%s', (llegada, texto) => {
    expect(classArrivalText(llegada, clase)).toBe(texto);
  });
});

describe('classArrivalText a un lugar del perfil', () => {
  const hora = new Date(2026, 10, 9, 18, 0);
  it.each([
    [new Date(2026, 10, 9, 17, 50), 'Llegaste 10 min antes de las 6:00 p. m.'],
    [new Date(2026, 10, 9, 18, 0), 'Llegaste justo a las 6:00 p. m.'],
    [new Date(2026, 10, 9, 18, 4), 'Llegaste 4 min después de las 6:00 p. m.'],
  ])('%s', (llegada, texto) => {
    expect(classArrivalText(llegada, hora, false)).toBe(texto);
  });
});
