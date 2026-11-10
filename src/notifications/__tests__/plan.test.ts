import { routesRepository } from '../../data/repository';
import { EMPTY_PROFILE, type ClassEntry, type Place, type Profile } from '../../profile/model';
import {
  arrivalNotice,
  CLASS_REMINDER_MINUTES,
  DEPARTURE_LEAD_MINUTES,
  MORNING_LEAD_MINUTES,
  planDailyNotices,
} from '../plan';

// Centro de Montería: varias rutas (ficticias) pasan cerca.
const casa: Place = {
  id: 'casa',
  name: 'Casa',
  icon: 'home',
  coordinate: { latitude: 8.759, longitude: -75.879 },
};
const finca: Place = { ...casa, id: 'finca', coordinate: { latitude: 8.6, longitude: -76.05 } };
const clase = (id: string, day: ClassEntry['day'], hours: number, name = ''): ClassEntry => ({
  id,
  day,
  start: { hours, minutes: 0 },
  name,
});

const profile = (overrides: Partial<Profile>): Profile => ({
  ...EMPTY_PROFILE,
  classes: [clase('lun7', 1, 7, 'Cálculo'), clase('lun10', 1, 10), clase('mie9', 3, 9)],
  places: [casa],
  notices: { morning: true, departure: true, arrival: false },
  ...overrides,
});

// Domingo 8 de noviembre de 2026, 8:00 p. m.
const domingo = new Date(2026, 10, 8, 20, 0);
const plan = (p: Profile, now = domingo) =>
  planDailyNotices({ profile: p, repo: routesRepository, now, routeName: (id) => id });

const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

describe('planDailyNotices', () => {
  it('sin avisos activados no programa nada', () => {
    expect(plan(profile({ notices: { morning: false, departure: false, arrival: true } }))).toEqual(
      [],
    );
  });

  it('solo la primera clase de cada día, con salida calculada desde Casa', () => {
    const notices = plan(profile({}));
    expect(notices.map((n) => n.id)).toEqual([
      'morning:2026-11-09',
      'departure:2026-11-09',
      'morning:2026-11-11',
      'departure:2026-11-11',
    ]);

    const [morning, departure] = notices;
    expect(morning.title).toBe('Hoy: Cálculo a las 7:00 a. m.');
    expect(morning.body).toMatch(
      /^Sal de Casa a las \d+:\d\d a\. m\. y toma la \w+ en .+ a las \d+:\d\d a\. m\.$/,
    );
    expect(departure.title).toBe(`Sal en ${DEPARTURE_LEAD_MINUTES} min`);
    expect(departure.body).toMatch(
      /^Para tu Cálculo a las 7:00 a\. m\.: toma la \w+ en .+ a las \d+:\d\d a\. m\.$/,
    );
    // Ambos salen de la misma hora de salida.
    expect(minutes(morning.fireAt, departure.fireAt)).toBe(
      MORNING_LEAD_MINUTES - DEPARTURE_LEAD_MINUTES,
    );
    // Y la salida deja llegar antes de la clase.
    expect(departure.fireAt < new Date(2026, 10, 9, 7, 0)).toBe(true);
  });

  it('respeta qué avisos activó el usuario', () => {
    const notices = plan(profile({ notices: { morning: false, departure: true, arrival: false } }));
    expect(notices.every((n) => n.kind === 'departure')).toBe(true);
    expect(notices).toHaveLength(2);
  });

  it('sin Casa solo recuerda la hora de la clase', () => {
    const notices = plan(profile({ places: [] }));
    expect(notices.map((n) => n.id)).toEqual(['morning:2026-11-09', 'morning:2026-11-11']);
    expect(notices[0].body).toBe('Guarda tu Casa en Mi perfil y te decimos a qué hora salir.');
    expect(minutes(notices[0].fireAt, new Date(2026, 10, 9, 7, 0))).toBe(CLASS_REMINDER_MINUTES);
  });

  it('si ninguna ruta sirve desde Casa, lo dice', () => {
    const lejos = { ...finca, icon: 'home' as const };
    const [first] = plan(profile({ places: [lejos] }));
    expect(first.body).toMatch(/^Ninguna ruta cargada te deja a tiempo desde Casa/);
  });

  it('no programa avisos que ya pasaron', () => {
    // Lunes 6:55 a. m.: los avisos de hoy ya pasaron; quedan los del miércoles.
    const notices = plan(profile({}), new Date(2026, 10, 9, 6, 55));
    expect(notices.map((n) => n.id)).toEqual(['morning:2026-11-11', 'departure:2026-11-11']);
  });

  it('programa a lo sumo una semana', () => {
    const notices = plan(profile({}));
    const last = notices[notices.length - 1].fireAt;
    expect(minutes(domingo, last)).toBeLessThan(7 * 24 * 60);
  });
});

describe('arrivalNotice', () => {
  const now = new Date(2026, 10, 9, 6, 0);
  const at = (m: number) => new Date(now.getTime() + m * 60_000);
  const input = { now, routeName: 'T2', stopName: 'Calle 41', walkToStopMinutes: 0 };

  it('avisa 5 min antes si la parada está cerca', () => {
    const notice = arrivalNotice({ ...input, boardAt: at(12) })!;
    expect(notice.fireAt).toEqual(at(7));
    expect(notice.title).toBe('Tu T2 se acerca');
    expect(notice.body).toBe('Pasa por Calle 41 en unos 5 min (a las 6:12 a. m.).');
  });

  it('con caminata, avisa con tiempo para llegar a la parada', () => {
    expect(arrivalNotice({ ...input, walkToStopMinutes: 6, boardAt: at(20) })!.fireAt).toEqual(
      at(12),
    );
  });

  it('si ya no hay tiempo, no avisa', () => {
    expect(arrivalNotice({ ...input, boardAt: at(5) })).toBeNull();
    expect(arrivalNotice({ ...input, boardAt: at(3) })).toBeNull();
  });
});
