// Perfil del estudiante (etapa 4.1): horario de clases, lugares frecuentes y opciones de
// caminata. Vive solo en el teléfono (ver docs/PERFIL.md). Funciones puras: la hora y los
// datos se inyectan para poder probarlas.
import type { LatLng } from '../data/geo';
import type { ClassTime } from '../lib/classTime';
import {
  DEFAULT_WALKING,
  MAX_WALK_LIMIT,
  MIN_WALK_LIMIT,
  type WalkingPrefs,
} from '../planner/recommend';

/** Día de la semana como en Date.getDay(): 0 = domingo … 6 = sábado. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Orden en que se muestran los días (la semana empieza el lunes, como en Colombia). */
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

export const WEEKDAY_NAME: Record<Weekday, string> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
};

/** Una clase del horario. Siempre es en la universidad (sede Montería). */
export type ClassEntry = {
  id: string;
  day: Weekday;
  start: ClassTime;
  /** Nombre opcional, ej. "Cálculo". */
  name: string;
};

export type PlaceIcon = 'home' | 'work' | 'other';

/** Lugar frecuente que guarda el usuario (casa, trabajo...). */
export type Place = {
  id: string;
  name: string;
  icon: PlaceIcon;
  coordinate: LatLng;
};

/** Avisos locales (etapa 4.2): cada tipo se activa por separado. Todos apagados por defecto. */
export type NoticePrefs = {
  /** Sugerencia de la mañana: ruta y hora de salida para la primera clase del día. */
  morning: boolean;
  /** "Sal en 10 min para llegar a tu clase de las 7". */
  departure: boolean;
  /** Mientras esperas: "Tu bus se acerca". */
  arrival: boolean;
};

export const DEFAULT_NOTICES: NoticePrefs = { morning: false, departure: false, arrival: false };

export type Profile = {
  classes: ClassEntry[];
  places: Place[];
  walking: WalkingPrefs;
  notices: NoticePrefs;
};

export const EMPTY_PROFILE: Profile = {
  classes: [],
  places: [],
  walking: DEFAULT_WALKING,
  notices: DEFAULT_NOTICES,
};

export const MAX_PLACES = 10;
export const MAX_CLASSES_PER_DAY = 12;
export const MAX_NAME_LENGTH = 30;

const minutesOf = ({ hours, minutes }: ClassTime) => hours * 60 + minutes;

/** Clases de un día, ordenadas por hora de entrada. */
export function classesOn(classes: ClassEntry[], day: Weekday): ClassEntry[] {
  return classes
    .filter((c) => c.day === day)
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}

/** La próxima clase de hoy que aún no empieza, o null si ya no quedan. */
export function nextClass(classes: ClassEntry[], now: Date): ClassEntry | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay() as Weekday;
  return classesOn(classes, day).find((c) => minutesOf(c.start) > nowMinutes) ?? null;
}

/** Nombre limpio (sin espacios de más, recortado al máximo). */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

// --- Validación de lo que se lee del almacenamiento -------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function parseClassTime(v: unknown): ClassTime | null {
  if (!isObject(v) || !isInt(v.hours, 0, 23) || !isInt(v.minutes, 0, 59)) return null;
  return { hours: v.hours, minutes: v.minutes };
}

function parseCoordinate(v: unknown): LatLng | null {
  if (!isObject(v)) return null;
  const { latitude, longitude } = v;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function parseClass(v: unknown): ClassEntry | null {
  if (!isObject(v) || typeof v.id !== 'string' || !isInt(v.day, 0, 6)) return null;
  const start = parseClassTime(v.start);
  if (!start) return null;
  return {
    id: v.id,
    day: v.day as Weekday,
    start,
    name: typeof v.name === 'string' ? cleanName(v.name) : '',
  };
}

function parsePlace(v: unknown): Place | null {
  if (!isObject(v) || typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  const name = cleanName(v.name);
  const coordinate = parseCoordinate(v.coordinate);
  if (!name || !coordinate) return null;
  const icon: PlaceIcon = v.icon === 'home' || v.icon === 'work' ? v.icon : 'other';
  return { id: v.id, name, icon, coordinate };
}

function parseWalking(v: unknown): WalkingPrefs {
  if (!isObject(v)) return DEFAULT_WALKING;
  const pace = v.pace === 'slow' ? 'slow' : 'normal';
  const maxWalkMinutes = isInt(v.maxWalkMinutes, MIN_WALK_LIMIT, MAX_WALK_LIMIT)
    ? v.maxWalkMinutes
    : null;
  return { pace, maxWalkMinutes };
}

function parseNotices(v: unknown): NoticePrefs {
  if (!isObject(v)) return DEFAULT_NOTICES;
  return {
    morning: v.morning === true,
    departure: v.departure === true,
    arrival: v.arrival === true,
  };
}

const present = <T>(v: T | null): v is T => v !== null;

/**
 * Perfil a partir de lo guardado. Descarta lo que no sea válido (una clase dañada no borra el
 * resto) y lanza solo si no es un objeto.
 */
export function parseProfile(raw: unknown): Profile {
  if (!isObject(raw)) throw new Error('Perfil inválido');
  const classes = Array.isArray(raw.classes) ? raw.classes.map(parseClass).filter(present) : [];
  const places = Array.isArray(raw.places) ? raw.places.map(parsePlace).filter(present) : [];
  return {
    classes,
    places: places.slice(0, MAX_PLACES),
    walking: parseWalking(raw.walking),
    notices: parseNotices(raw.notices),
  };
}
