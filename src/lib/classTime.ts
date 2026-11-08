/** Hora de entrada a clase (hora local, formato 24 h). */
export type ClassTime = { hours: number; minutes: number };

export const DEFAULT_CLASS_TIME: ClassTime = { hours: 7, minutes: 0 };

/** "7:00 a. m.", "2:30 p. m." — formato habitual en Colombia, sin depender de Intl. */
export function formatClassTime({ hours, minutes }: ClassTime): string {
  const suffix = hours < 12 ? 'a. m.' : 'p. m.';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** Fecha de hoy a la hora indicada (lo que necesita el selector de hora). */
export function classTimeToDate({ hours, minutes }: ClassTime, base = new Date()): Date {
  const date = new Date(base);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function dateToClassTime(date: Date): ClassTime {
  return { hours: date.getHours(), minutes: date.getMinutes() };
}
