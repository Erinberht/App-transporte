import { MAX_CLASSES_PER_DAY, MAX_PLACES } from '../model';
import { createProfileStore, PROFILE_KEY, type ProfileStorage } from '../store';

function memoryStorage(initial?: string): ProfileStorage & { data: Map<string, string> } {
  const data = new Map<string, string>(initial ? [[PROFILE_KEY, initial]] : []);
  return {
    data,
    getItemSync: (k) => data.get(k) ?? null,
    setItemSync: (k, v) => void data.set(k, v),
    removeItemSync: (k) => data.delete(k),
  };
}

const casa = {
  name: 'Casa',
  icon: 'home' as const,
  coordinate: { latitude: 8.75, longitude: -75.88 },
};

describe('profileStore', () => {
  it('empieza vacío y guarda cada cambio', () => {
    const storage = memoryStorage();
    const store = createProfileStore(storage);
    expect(store.get().classes).toEqual([]);

    const id = store.addClass(1, { hours: 7, minutes: 0 }, '  Cálculo ');
    expect(store.get().classes).toEqual([
      { id, day: 1, start: { hours: 7, minutes: 0 }, name: 'Cálculo' },
    ]);
    // Otra instancia (como al reabrir la app) lee lo mismo del almacenamiento.
    expect(createProfileStore(storage).get()).toEqual(store.get());
  });

  it('edita y quita clases', () => {
    const store = createProfileStore(memoryStorage());
    const id = store.addClass(2, { hours: 7, minutes: 0 })!;
    store.updateClass(id, { start: { hours: 9, minutes: 30 }, name: 'Física' });
    expect(store.get().classes[0]).toMatchObject({
      start: { hours: 9, minutes: 30 },
      name: 'Física',
    });
    store.removeClass(id);
    expect(store.get().classes).toEqual([]);
  });

  it('no deja más clases por día que el máximo', () => {
    const store = createProfileStore(memoryStorage());
    for (let i = 0; i < MAX_CLASSES_PER_DAY; i++) store.addClass(1, { hours: 6 + i, minutes: 0 });
    expect(store.addClass(1, { hours: 23, minutes: 0 })).toBeNull();
    expect(store.addClass(2, { hours: 7, minutes: 0 })).not.toBeNull();
  });

  it('guarda, edita y borra lugares', () => {
    const store = createProfileStore(memoryStorage());
    const id = store.savePlace(casa)!;
    expect(store.get().places).toEqual([{ ...casa, id }]);

    expect(store.savePlace({ ...casa, id, name: 'Casa de mamá' })).toBe(id);
    expect(store.get().places).toHaveLength(1);
    expect(store.get().places[0].name).toBe('Casa de mamá');

    expect(store.savePlace({ ...casa, name: '   ' })).toBeNull();
    store.removePlace(id);
    expect(store.get().places).toEqual([]);
  });

  it('no deja más lugares que el máximo', () => {
    const store = createProfileStore(memoryStorage());
    for (let i = 0; i < MAX_PLACES; i++) store.savePlace({ ...casa, name: `L${i}` });
    expect(store.savePlace(casa)).toBeNull();
  });

  it('avisa a los suscriptores', () => {
    const store = createProfileStore(memoryStorage());
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    store.setWalking({ pace: 'slow', maxWalkMinutes: 6 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.setWalking({ pace: 'normal', maxWalkMinutes: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('"Borrar mi perfil" elimina todo del teléfono', () => {
    const storage = memoryStorage();
    const store = createProfileStore(storage);
    store.addClass(1, { hours: 7, minutes: 0 });
    store.savePlace(casa);
    store.setWalking({ pace: 'slow', maxWalkMinutes: 4 });
    store.clear();
    expect(storage.data.has(PROFILE_KEY)).toBe(false);
    expect(store.get()).toEqual({
      classes: [],
      places: [],
      walking: { pace: 'normal', maxWalkMinutes: null },
      notices: { morning: false, departure: false, arrival: false },
    });
  });

  it('descarta un perfil dañado', () => {
    const storage = memoryStorage('{no es json');
    expect(createProfileStore(storage).get().places).toEqual([]);
    expect(storage.data.has(PROFILE_KEY)).toBe(false);
  });
});
