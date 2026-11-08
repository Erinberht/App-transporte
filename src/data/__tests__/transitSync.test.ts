import type { AppSupabaseClient } from '../../api/supabase';
import type { TransitDataset } from '../model';
import { BUNDLED_DATASET, getActiveDataset, routesRepository } from '../repository';
import { CACHE_KEY, loadCachedDataset, refreshDataset, type KeyValueStorage } from '../transitSync';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: KeyValueStorage & { data: Map<string, string> } = {
    data,
    getItemSync: (k) => data.get(k) ?? null,
    removeItemSync: (k) => data.delete(k),
    setItemAsync: async (k, v) => void data.set(k, v),
  };
  return storage;
}

/** Copia de los datos incluidos con otra fecha y la ruta P1 renombrada. */
function variant(generatedAt: string, longName = 'Pradera 27 (servidor)'): TransitDataset {
  const ds: TransitDataset = JSON.parse(JSON.stringify(BUNDLED_DATASET));
  ds.source = { ...ds.source, kind: 'import', generatedAt };
  ds.routes.find((r) => r.id === 'P1')!.longName = longName;
  return ds;
}

const NEWER = '2099-01-01T00:00:00.000Z';
const OLDER = '2000-01-01T00:00:00.000Z';

function clientReturning(data: unknown, error: unknown = null) {
  return { rpc: jest.fn(async () => ({ data, error })) } as unknown as AppSupabaseClient;
}

afterEach(() => {
  loadCachedDataset(memoryStorage()); // vuelve a los datos incluidos
});

describe('loadCachedDataset', () => {
  it('sin copia usa los datos incluidos', () => {
    expect(loadCachedDataset(memoryStorage())).toBe('bundled');
    expect(getActiveDataset()).toBe(BUNDLED_DATASET);
  });

  it('usa la copia guardada si es más nueva', () => {
    const storage = memoryStorage({ [CACHE_KEY]: JSON.stringify(variant(NEWER)) });

    expect(loadCachedDataset(storage)).toBe('cache');
    expect(routesRepository.getRoute('P1')?.longName).toBe('Pradera 27 (servidor)');
  });

  it('ignora una copia más vieja que los datos incluidos (ej. tras actualizar la app)', () => {
    const storage = memoryStorage({ [CACHE_KEY]: JSON.stringify(variant(OLDER)) });

    expect(loadCachedDataset(storage)).toBe('bundled');
    expect(routesRepository.getRoute('P1')?.longName).toBe('Pradera 27');
  });

  it('descarta una copia dañada', () => {
    const storage = memoryStorage({ [CACHE_KEY]: '{no es json' });

    expect(loadCachedDataset(storage)).toBe('bundled');
    expect(storage.data.has(CACHE_KEY)).toBe(false);
  });

  it('descarta una copia que no pasa la validación', () => {
    const bad = { ...variant(NEWER), routes: [] };
    const storage = memoryStorage({ [CACHE_KEY]: JSON.stringify(bad) });

    expect(loadCachedDataset(storage)).toBe('bundled');
    expect(storage.data.has(CACHE_KEY)).toBe(false);
  });
});

describe('refreshDataset', () => {
  it('sin backend configurado no hace nada', async () => {
    expect(await refreshDataset(null, memoryStorage())).toBe('disabled');
  });

  it('guarda datos más nuevos para el próximo arranque, sin cambiar los actuales', async () => {
    const storage = memoryStorage();

    expect(await refreshDataset(clientReturning(variant(NEWER)), storage)).toBe('saved');
    expect(routesRepository.getRoute('P1')?.longName).toBe('Pradera 27');

    expect(loadCachedDataset(storage)).toBe('cache');
    expect(routesRepository.getRoute('P1')?.longName).toBe('Pradera 27 (servidor)');
  });

  it('si el servidor tiene lo mismo no guarda nada', async () => {
    const storage = memoryStorage();
    expect(await refreshDataset(clientReturning(BUNDLED_DATASET), storage)).toBe('unchanged');
    expect(storage.data.size).toBe(0);
  });

  it('si falla la red sigue con lo que tiene', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = memoryStorage();

    expect(await refreshDataset(clientReturning(null, { message: 'offline' }), storage)).toBe(
      'error',
    );
    expect(storage.data.size).toBe(0);
    expect(getActiveDataset()).toBe(BUNDLED_DATASET);
    warn.mockRestore();
  });
});
