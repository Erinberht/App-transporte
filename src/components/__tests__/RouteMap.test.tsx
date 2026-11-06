import { render, screen } from '@testing-library/react-native';
import { useNetworkState } from 'expo-network';

import { SAMPLE_ROUTE_PATH } from '../../data/geo';
import { RouteMap } from '../RouteMap';

const mockedNetwork = jest.mocked(useNetworkState);

describe('RouteMap', () => {
  afterEach(() => {
    mockedNetwork.mockReturnValue({ isConnected: true, isInternetReachable: true });
  });

  it('con conexión dibuja el mapa real con el recorrido punteado', async () => {
    await render(<RouteMap height={200} busLabel="T2" />);

    expect(screen.getByTestId('map-view')).toBeOnTheScreen();
    const polyline = screen.getByTestId('map-polyline');
    expect(polyline.props.coordinates).toEqual(SAMPLE_ROUTE_PATH);
    expect(polyline.props.lineDashPattern).toBeDefined();
    expect(screen.getByText('Tu parada')).toBeOnTheScreen();
    expect(screen.getByText('T2')).toBeOnTheScreen();
    expect(screen.queryByText(/Sin conexión/)).not.toBeOnTheScreen();
  });

  it('centra el mapa en Montería', async () => {
    await render(<RouteMap height={200} />);

    const { latitude, longitude } = screen.getByTestId('map-view').props.initialRegion;
    expect(latitude).toBeCloseTo(8.77, 1);
    expect(longitude).toBeCloseTo(-75.87, 1);
  });

  it('sin bus (busLabel vacío) no muestra el marcador del bus', async () => {
    await render(<RouteMap height={200} />);

    expect(screen.getByText('Tu parada')).toBeOnTheScreen();
    expect(screen.queryByText('T2')).not.toBeOnTheScreen();
  });

  it('sin conexión muestra el mapa ilustrativo de respaldo', async () => {
    mockedNetwork.mockReturnValue({ isConnected: false, isInternetReachable: false });

    await render(<RouteMap height={200} busLabel="T2" />);

    expect(screen.queryByTestId('map-view')).not.toBeOnTheScreen();
    expect(screen.getByText('Sin conexión · mapa ilustrativo')).toBeOnTheScreen();
    expect(screen.getByText('Tu parada')).toBeOnTheScreen();
    expect(screen.getByText('T2')).toBeOnTheScreen();
  });

  it('con red pero sin internet también usa el respaldo', async () => {
    mockedNetwork.mockReturnValue({ isConnected: true, isInternetReachable: false });

    await render(<RouteMap height={200} />);

    expect(screen.getByText('Sin conexión · mapa ilustrativo')).toBeOnTheScreen();
  });
});
