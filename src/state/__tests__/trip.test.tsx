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

  it('falla con un mensaje claro si se usa fuera del provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useTrip())).rejects.toThrow(
      'useTrip debe usarse dentro de <TripProvider>',
    );
    spy.mockRestore();
  });
});
