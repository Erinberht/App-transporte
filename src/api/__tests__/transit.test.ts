import dataset from '../../data/dataset.json';
import { readSupabaseConfig, type AppSupabaseClient } from '../supabase';
import {
  ApiError,
  deleteMyData,
  ensureAnonymousSession,
  fetchRouteLiveStatus,
  fetchTransitDataset,
} from '../transit';

type Mock = {
  rpc: jest.Mock;
  auth: { getSession: jest.Mock; signInAnonymously: jest.Mock; signOut: jest.Mock };
};

function mockClient(overrides: Partial<Mock> = {}): Mock & AppSupabaseClient {
  return {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      signInAnonymously: jest.fn(async () => ({ data: { user: { id: 'anon-1' } }, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
    },
    ...overrides,
  } as unknown as Mock & AppSupabaseClient;
}

describe('readSupabaseConfig', () => {
  it('sin variables no hay backend', () => {
    expect(readSupabaseConfig({ url: undefined, publishableKey: undefined })).toBeNull();
    expect(readSupabaseConfig({ url: ' ', publishableKey: 'k' })).toBeNull();
  });

  it('con variables devuelve la configuración sin espacios', () => {
    expect(readSupabaseConfig({ url: ' http://x ', publishableKey: 'sb_publishable_1 ' })).toEqual({
      url: 'http://x',
      publishableKey: 'sb_publishable_1',
    });
  });
});

describe('fetchTransitDataset', () => {
  it('descarga y valida el catálogo', async () => {
    const client = mockClient();
    client.rpc.mockResolvedValue({ data: dataset, error: null });

    const result = await fetchTransitDataset(client);

    expect(client.rpc).toHaveBeenCalledWith('get_transit_dataset');
    expect(result.routes).toHaveLength(10);
  });

  it('error de red -> ApiError', async () => {
    const client = mockClient();
    client.rpc.mockResolvedValue({ data: null, error: { message: 'fetch failed' } });

    await expect(fetchTransitDataset(client)).rejects.toThrow(ApiError);
  });

  it('datos inválidos -> ApiError (no se usan)', async () => {
    const client = mockClient();
    client.rpc.mockResolvedValue({ data: { ...dataset, routes: [] }, error: null });

    await expect(fetchTransitDataset(client)).rejects.toThrow(
      'El servidor devolvió rutas inválidas',
    );
  });
});

describe('fetchRouteLiveStatus', () => {
  it('convierte la fila agregada', async () => {
    const client = mockClient();
    client.rpc.mockResolvedValue({
      data: [
        {
          active_trips: 2,
          latitude: 8.77,
          longitude: -75.87,
          position_at: '2026-11-09T12:00:00Z',
          occupancy: 'full',
          occupancy_reports: 3,
          occupancy_at: '2026-11-09T11:58:00Z',
        },
      ],
      error: null,
    });

    const status = await fetchRouteLiveStatus(client, 'P1');

    expect(client.rpc).toHaveBeenCalledWith('route_live_status', { p_route_id: 'P1' });
    expect(status.activeTrips).toBe(2);
    expect(status.position).toEqual({
      latitude: 8.77,
      longitude: -75.87,
      at: new Date('2026-11-09T12:00:00Z'),
    });
    expect(status.occupancy?.level).toBe('full');
  });

  it('sin viajeros ni reportes no inventa posición ni cupo', async () => {
    const client = mockClient();
    client.rpc.mockResolvedValue({
      data: [
        {
          active_trips: 0,
          latitude: null,
          longitude: null,
          position_at: null,
          occupancy: null,
          occupancy_reports: 0,
          occupancy_at: null,
        },
      ],
      error: null,
    });

    expect(await fetchRouteLiveStatus(client, 'RG')).toEqual({
      activeTrips: 0,
      position: null,
      occupancy: null,
    });
  });
});

describe('sesión anónima', () => {
  it('reutiliza la sesión existente', async () => {
    const client = mockClient();
    client.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'ya-existe' } } },
      error: null,
    });

    expect(await ensureAnonymousSession(client)).toBe('ya-existe');
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('crea una sesión anónima si no hay', async () => {
    const client = mockClient();
    expect(await ensureAnonymousSession(client)).toBe('anon-1');
  });

  it('si falla lanza ApiError', async () => {
    const client = mockClient();
    client.auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { message: 'rate limit' },
    });
    await expect(ensureAnonymousSession(client)).rejects.toThrow(ApiError);
  });
});

describe('deleteMyData', () => {
  it('sin sesión no llama al servidor', async () => {
    const client = mockClient();
    await deleteMyData(client);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('con sesión borra en el servidor y cierra la sesión local', async () => {
    const client = mockClient();
    client.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'anon-1' } } },
      error: null,
    });
    client.rpc.mockResolvedValue({ data: null, error: null });

    await deleteMyData(client);

    expect(client.rpc).toHaveBeenCalledWith('delete_my_data');
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
