import { act, renderHook } from '@testing-library/react-native';

import { TripProvider, useTrip } from '../trip';

describe('TripProvider / useTrip', () => {
  it('arranca con la ruta T2, cupo medio y sin compartir', async () => {
    const { result } = await renderHook(() => useTrip(), { wrapper: TripProvider });

    expect(result.current.routeId).toBe('T2');
    expect(result.current.occupancy).toBe('medium');
    expect(result.current.sharing).toBe(false);
  });

  it('actualiza ruta, cupo y estado de compartir', async () => {
    const { result } = await renderHook(() => useTrip(), { wrapper: TripProvider });

    await act(() => result.current.setRouteId('P1'));
    await act(() => result.current.setOccupancy('full'));
    await act(() => result.current.setSharing(true));

    expect(result.current.routeId).toBe('P1');
    expect(result.current.occupancy).toBe('full');
    expect(result.current.sharing).toBe(true);
  });

  it('reset vuelve a los valores iniciales', async () => {
    const { result } = await renderHook(() => useTrip(), { wrapper: TripProvider });

    await act(() => {
      result.current.setRouteId('RG');
      result.current.setOccupancy('empty');
      result.current.setSharing(true);
    });
    await act(() => result.current.reset());

    expect(result.current.routeId).toBe('T2');
    expect(result.current.occupancy).toBe('medium');
    expect(result.current.sharing).toBe(false);
  });

  it('arranca con la sede Montería, entrada a las 7:00 y sin origen', async () => {
    const { result } = await renderHook(() => useTrip(), { wrapper: TripProvider });

    expect(result.current.destinationId).toBe('unicordoba-monteria');
    expect(result.current.classTime).toEqual({ hours: 7, minutes: 0 });
    expect(result.current.origin).toBeNull();
  });

  it('reset borra la ubicación pero conserva destino y hora de clase', async () => {
    const { result } = await renderHook(() => useTrip(), { wrapper: TripProvider });

    await act(() => {
      result.current.setClassTime({ hours: 10, minutes: 30 });
      result.current.setOrigin({ latitude: 8.76, longitude: -75.88 });
    });
    await act(() => result.current.reset());

    expect(result.current.origin).toBeNull();
    expect(result.current.classTime).toEqual({ hours: 10, minutes: 30 });
    expect(result.current.destinationId).toBe('unicordoba-monteria');
  });

  it('falla con un mensaje claro si se usa fuera del provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useTrip())).rejects.toThrow(
      'useTrip debe usarse dentro de <TripProvider>',
    );
    spy.mockRestore();
  });
});
