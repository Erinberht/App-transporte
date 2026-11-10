// Qué avisos locales programar (etapa 4.2a). Funciones puras: el perfil, las rutas y la hora se
// inyectan. Los efectos (expo-notifications) viven en scheduler.ts.
//
// Las horas terminan en "a. m." / "p. m.": los textos nunca ponen un punto justo después.
//
// - Sugerencia de la mañana y aviso de salida: para la PRIMERA clase de cada día (las demás ya
//   te encuentran en el campus), calculadas con el motor de recomendación desde tu lugar "Casa".
//   Sin Casa guardada solo se recuerda la hora de la clase.
// - Llegada del bus: mientras esperas en "Esperando tu bus", según la hora en que pasa.
import { DESTINATIONS } from '../data/destinations';
import type { RoutesRepository } from '../data/repository';
import { formatClassTime, dateToClassTime } from '../lib/classTime';
import { recommendRoutes, SAFETY_BUFFER_MINUTES, type TripOption } from '../planner/recommend';
import { classesOn, type Profile, type Weekday } from '../profile/model';

/** El aviso de salida llega estos minutos antes de la hora de salir. */
export const DEPARTURE_LEAD_MINUTES = 10;
/** La sugerencia de la mañana llega estos minutos antes de la hora de salir. */
export const MORNING_LEAD_MINUTES = 45;
/** Sin Casa (o sin ruta), el recordatorio llega estos minutos antes de la clase. */
export const CLASS_REMINDER_MINUTES = 90;
/** Días que se programan por adelantado (se reprograma al abrir la app). */
export const NOTICE_DAYS = 7;
/** Para calcular la última salida, el motor mira desde esta antelación. */
const LOOKAHEAD_MINUTES = 180;
/** La alerta de llegada avisa al menos estos minutos antes de que pase el bus. */
export const ARRIVAL_MIN_LEAD_MINUTES = 5;

const MINUTE = 60_000;
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * MINUTE);
const clock = (d: Date) => formatClassTime(dateToClassTime(d));
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type NoticeKind = 'morning' | 'departure' | 'arrival';

export type Notice = {
  /** Identificador estable (reprogramar reemplaza el aviso anterior con el mismo id). */
  id: string;
  kind: NoticeKind;
  fireAt: Date;
  title: string;
  body: string;
};

type DailyInput = {
  profile: Profile;
  repo: RoutesRepository;
  now: Date;
  /** Nombre corto de la ruta (ej. "T2"). */
  routeName: (routeId: string) => string;
  days?: number;
};

/** Salida recomendada desde Casa: la última que aún llega con colchón a la clase. */
function departureFromHome(
  input: DailyInput,
  home: Profile['places'][number],
  classAt: Date,
): { leaveAt: Date; option?: TripOption; walkMinutes?: number } | null {
  const plan = recommendRoutes({
    repo: input.repo,
    origin: home.coordinate,
    destination: DESTINATIONS[0].coordinate,
    arriveBy: classAt,
    now: addMinutes(classAt, -LOOKAHEAD_MINUTES),
    walking: input.profile.walking,
  });
  if (plan.walkInstead) {
    const leaveAt = addMinutes(classAt, -(plan.walkInstead.minutes + SAFETY_BUFFER_MINUTES));
    return { leaveAt, walkMinutes: plan.walkInstead.minutes };
  }
  const best = plan.options.find((o): o is TripOption => o.kind === 'trip' && o.marginMinutes >= 0);
  if (!best) return null;
  return { leaveAt: best.latestLeaveAt ?? best.leaveAt, option: best };
}

/** Avisos de la mañana y de salida para los próximos días, según lo que el usuario activó. */
export function planDailyNotices(input: DailyInput): Notice[] {
  const { profile, now, days = NOTICE_DAYS } = input;
  const { morning, departure } = profile.notices;
  if (!morning && !departure) return [];
  const home = profile.places.find((p) => p.icon === 'home');
  const notices: Notice[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const [first] = classesOn(profile.classes, date.getDay() as Weekday);
    if (!first) continue;
    const classAt = new Date(date);
    classAt.setHours(first.start.hours, first.start.minutes, 0, 0);
    const what = first.name
      ? `${first.name} a las ${clock(classAt)}`
      : `clase a las ${clock(classAt)}`;
    const key = dayKey(date);
    const trip = home ? departureFromHome(input, home, classAt) : null;

    if (trip) {
      // "toma la T2 en Calle 41 a las 6:28 a. m." o "ve caminando (12 min)".
      const how = trip.option
        ? `toma la ${input.routeName(trip.option.routeId)} en ${trip.option.boardStop.name} a las ${clock(addMinutes(trip.leaveAt, trip.option.walkToStopMinutes))}`
        : `ve caminando (${trip.walkMinutes} min)`;
      if (morning) {
        notices.push({
          id: `morning:${key}`,
          kind: 'morning',
          fireAt: addMinutes(trip.leaveAt, -MORNING_LEAD_MINUTES),
          title: `Hoy: ${what}`,
          body: `Sal de ${home!.name} a las ${clock(trip.leaveAt)} y ${how}`,
        });
      }
      if (departure) {
        notices.push({
          id: `departure:${key}`,
          kind: 'departure',
          fireAt: addMinutes(trip.leaveAt, -DEPARTURE_LEAD_MINUTES),
          title: `Sal en ${DEPARTURE_LEAD_MINUTES} min`,
          body: `Para tu ${what}: ${how}`,
        });
      }
    } else if (morning) {
      // Sin Casa no se sabe a qué hora salir; sin ruta, no hay qué sugerir.
      notices.push({
        id: `morning:${key}`,
        kind: 'morning',
        fireAt: addMinutes(classAt, -CLASS_REMINDER_MINUTES),
        title: `Hoy: ${what}`,
        body: home
          ? `Ninguna ruta cargada te deja a tiempo desde ${home.name}. Abre Mi bus para ver opciones.`
          : 'Guarda tu Casa en Mi perfil y te decimos a qué hora salir.',
      });
    }
  }

  return notices.filter((n) => n.fireAt > now).sort((a, b) => +a.fireAt - +b.fireAt);
}

/**
 * Alerta de llegada mientras esperas: avisa con tiempo para caminar a la parada (y al menos
 * 5 min antes). null si ya no hay tiempo para avisar.
 */
export function arrivalNotice(input: {
  boardAt: Date;
  now: Date;
  walkToStopMinutes: number;
  routeName: string;
  stopName: string;
}): Notice | null {
  const lead = Math.max(ARRIVAL_MIN_LEAD_MINUTES, input.walkToStopMinutes + 2);
  const fireAt = addMinutes(input.boardAt, -lead);
  if (fireAt.getTime() - input.now.getTime() < 30_000) return null;
  return {
    id: 'arrival',
    kind: 'arrival',
    fireAt,
    title: `Tu ${input.routeName} se acerca`,
    body: `Pasa por ${input.stopName} en unos ${lead} min (a las ${clock(input.boardAt)}).`,
  };
}
