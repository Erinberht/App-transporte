// Cálculo de salidas a partir de los horarios por frecuencia (ServicePeriod).
// Usa la hora local del teléfono: Montería está en UTC-5 todo el año (sin horario de verano).
import type { BusRoute, DayType } from './model';
import { parseHHMM } from './validate';

export type ScheduleOptions = {
  /**
   * Indica si una fecha es festivo en Colombia (opera como domingo). Por ahora lo decide quien
   * llama; el calendario de festivos llegará con el modelo predictivo (etapa 5).
   */
  isHoliday?: (date: Date) => boolean;
};

export function dayTypeOf(date: Date, options: ScheduleOptions = {}): DayType {
  if (options.isHoliday?.(date)) return 'sunday_holiday';
  const day = date.getDay();
  if (day === 0) return 'sunday_holiday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const atMinutes = (day: Date, minutes: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);

/** Todas las salidas desde la cabecera en el día de `date`, en orden. */
export function departuresOn(route: BusRoute, date: Date, options: ScheduleOptions = {}): Date[] {
  const day = startOfDay(date);
  const period = route.service.find((s) => s.days === dayTypeOf(day, options));
  if (!period) return [];
  const out: Date[] = [];
  for (const h of period.headways) {
    const from = parseHHMM(h.from);
    const to = parseHHMM(h.to);
    if (from === null || to === null || h.everyMinutes <= 0) continue;
    for (let m = from; m < to; m += h.everyMinutes) out.push(atMinutes(day, m));
  }
  return out;
}

/** Cuántos días hacia adelante se buscan salidas (cubre un fin de semana largo sin servicio). */
const LOOKAHEAD_DAYS = 4;

/**
 * Próximas salidas desde la cabecera a partir de `from` (incluida), sumando `offsetMinutes`
 * (minutos desde la cabecera hasta la parada que interesa). Sigue al día siguiente si hace falta.
 */
export function nextDepartures(
  route: BusRoute,
  from: Date,
  count = 3,
  offsetMinutes = 0,
  options: ScheduleOptions = {},
): Date[] {
  const out: Date[] = [];
  const offsetMs = offsetMinutes * 60_000;
  for (let d = 0; d < LOOKAHEAD_DAYS && out.length < count; d++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + d);
    for (const departure of departuresOn(route, day, options)) {
      const atStop = new Date(departure.getTime() + offsetMs);
      if (atStop >= from) out.push(atStop);
      if (out.length === count) break;
    }
  }
  return out;
}
