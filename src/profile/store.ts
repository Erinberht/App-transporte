// Guarda el perfil en el teléfono (expo-sqlite/kv-store). Instancia única, sin React, para que
// cualquier pantalla lo lea igual; useProfile() lo conecta con los componentes.
// Nada de esto sale del teléfono: no hay sincronización con el backend (ver docs/PERFIL.md).
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import type { LatLng } from '../data/geo';
import type { ClassTime } from '../lib/classTime';
import type { WalkingPrefs } from '../planner/recommend';
import {
  cleanName,
  classesOn,
  EMPTY_PROFILE,
  MAX_CLASSES_PER_DAY,
  MAX_PLACES,
  parseProfile,
  type ClassEntry,
  type PlaceIcon,
  type Profile,
  type Weekday,
} from './model';

export const PROFILE_KEY = 'profile:v1';

/** Lo mínimo que se usa del almacenamiento (permite probar con uno en memoria). */
export type ProfileStorage = {
  getItemSync(key: string): string | null;
  setItemSync(key: string, value: string): unknown;
  removeItemSync(key: string): unknown;
};

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function createProfileStore(storage: ProfileStorage) {
  let profile: Profile | null = null;
  const listeners = new Set<() => void>();

  function load(): Profile {
    try {
      const raw = storage.getItemSync(PROFILE_KEY);
      if (raw) return parseProfile(JSON.parse(raw));
    } catch {
      // Dañado o de un formato anterior: se descarta.
      try {
        storage.removeItemSync(PROFILE_KEY);
      } catch {}
    }
    return EMPTY_PROFILE;
  }

  function get(): Profile {
    if (!profile) profile = load();
    return profile;
  }

  function set(next: Profile) {
    profile = next;
    try {
      storage.setItemSync(PROFILE_KEY, JSON.stringify(next));
    } catch {
      // Sin almacenamiento el perfil sigue en memoria mientras la app esté abierta.
    }
    listeners.forEach((l) => l());
  }

  const update = (fn: (p: Profile) => Profile) => set(fn(get()));

  return {
    get,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    /** Agrega una clase al día. Devuelve su id, o null si el día ya está lleno. */
    addClass(day: Weekday, start: ClassTime, name = ''): string | null {
      if (classesOn(get().classes, day).length >= MAX_CLASSES_PER_DAY) return null;
      const id = newId();
      update((p) => ({ ...p, classes: [...p.classes, { id, day, start, name: cleanName(name) }] }));
      return id;
    },
    updateClass(id: string, changes: Partial<Pick<ClassEntry, 'start' | 'name'>>) {
      update((p) => ({
        ...p,
        classes: p.classes.map((c) =>
          c.id === id
            ? {
                ...c,
                ...changes,
                name: changes.name !== undefined ? cleanName(changes.name) : c.name,
              }
            : c,
        ),
      }));
    },
    removeClass(id: string) {
      update((p) => ({ ...p, classes: p.classes.filter((c) => c.id !== id) }));
    },

    /** Guarda un lugar nuevo (sin id) o cambia uno existente. Devuelve su id o null si no cabe. */
    savePlace(place: {
      id?: string;
      name: string;
      icon: PlaceIcon;
      coordinate: LatLng;
    }): string | null {
      const name = cleanName(place.name);
      if (!name) return null;
      const current = get().places;
      if (place.id && current.some((p) => p.id === place.id)) {
        const id = place.id;
        update((p) => ({
          ...p,
          places: p.places.map((x) => (x.id === id ? { ...place, id, name } : x)),
        }));
        return id;
      }
      if (current.length >= MAX_PLACES) return null;
      const id = newId();
      update((p) => ({ ...p, places: [...p.places, { ...place, id, name }] }));
      return id;
    },
    removePlace(id: string) {
      update((p) => ({ ...p, places: p.places.filter((x) => x.id !== id) }));
    },

    setWalking(walking: WalkingPrefs) {
      update((p) => ({ ...p, walking }));
    },

    /** "Borrar mi perfil": elimina horario, lugares y opciones de caminata del teléfono. */
    clear() {
      profile = EMPTY_PROFILE;
      try {
        storage.removeItemSync(PROFILE_KEY);
      } catch {}
      listeners.forEach((l) => l());
    },

    /** Solo pruebas: olvida lo que hay en memoria (se vuelve a leer del almacenamiento). */
    reload() {
      profile = null;
      listeners.forEach((l) => l());
    },
  };
}

export type ProfileStore = ReturnType<typeof createProfileStore>;

export const profileStore = createProfileStore(Storage);

export function useProfile(): Profile {
  return useSyncExternalStore(profileStore.subscribe, profileStore.get, profileStore.get);
}
