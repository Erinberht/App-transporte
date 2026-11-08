import { render, screen } from '@testing-library/react-native';
import { useNetworkState } from 'expo-network';

import { routesRepository } from '../../data/repository';
import { tripMapData } from '../../data/tripMap';
import { RouteMap } from '../RouteMap';

const mockedNetwork = jest.mocked(useNetworkState);

describe('RouteMap', () => {
  afterEach(() => {
    mockedNetwork.mockReturnValue({ isConnected: true, isInternetReachable: true });
  });

  it('con conexión dibuja el mapa real con el recorrido punteado', async () => {
    await render(<RouteMap height={200} busLabel="T2" routeId="T2" />);

    expect(screen.getByTestId('map-view')).toBeOnTheScreen();
    const polyline = screen.getByTestId('map-polyline');
    expect(polyline.props.coordinates).toEqual(routesRepository.getPattern('T2')?.shape);
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

  it('dibuja el recorrido de la ruta elegida', async () => {
    await render(<RouteMap height={200} routeId="M1" />);

    const polyline = screen.getByTestId('map-polyline');
    expect(polyline.props.coordinates).toEqual(routesRepository.getPattern('M1')?.shape);
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

describe('tripMapData', () => {
  it('sin ubicación usa la cabecera como parada del usuario', () => {
    const data = tripMapData('P1');
    expect(data.userStop).toEqual(routesRepository.getPatternStops('P1')[0].coordinate);
    expect(data.quality).toBe('ficticio');
  });

  it('con ubicación elige la parada más cercana y pone el bus antes de ella', () => {
    const stops = routesRepository.getPatternStops('P1');
    const near = {
      latitude: stops[2].coordinate.latitude + 0.0005,
      longitude: stops[2].coordinate.longitude,
    };
    const data = tripMapData('P1', near);
    expect(data.userStop).toEqual(stops[2].coordinate);
    expect(data.busPosition.latitude).toBeLessThan(stops[2].coordinate.latitude);
    expect(data.busPosition.latitude).toBeGreaterThan(stops[1].coordinate.latitude);
  });

  it('la parada de destino es la de Unicórdoba aunque la ruta siga (AE va al aeropuerto)', () => {
    const data = tripMapData('AE');
    expect(data.destinationStop).toEqual(routesRepository.getStop('unicordoba')?.coordinate);
    expect(data.path[data.path.length - 1]).toEqual(
      routesRepository.getStop('aeropuerto')?.coordinate,
    );
  });

  it('una ruta desconocida usa la ruta por defecto', () => {
    expect(tripMapData('NO-EXISTE').path).toEqual(tripMapData('T2').path);
  });
});
