import {
  classesOn,
  cleanName,
  EMPTY_PROFILE,
  MAX_NAME_LENGTH,
  MAX_PLACES,
  nextClass,
  parseProfile,
  type ClassEntry,
} from '../model';

const clase = (id: string, day: ClassEntry['day'], hours: number, minutes = 0): ClassEntry => ({
  id,
  day,
  start: { hours, minutes },
  name: '',
});

// Lunes 9 de noviembre de 2026.
const lunes = (h: number, m = 0) => new Date(2026, 10, 9, h, m);

describe('horario', () => {
  const horario = [clase('c2', 1, 14), clase('c1', 1, 7), clase('m1', 2, 9)];

  it('classesOn ordena por hora y filtra por día', () => {
    expect(classesOn(horario, 1).map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(classesOn(horario, 0)).toEqual([]);
  });

  it('nextClass: la próxima de hoy que aún no empieza', () => {
    expect(nextClass(horario, lunes(6, 0))?.id).toBe('c1');
    expect(nextClass(horario, lunes(7, 0))?.id).toBe('c2'); // la de las 7 ya empezó
    expect(nextClass(horario, lunes(15, 0))).toBeNull(); // ya no quedan hoy
    expect(nextClass(horario, new Date(2026, 10, 8, 6))).toBeNull(); // domingo, sin clases
  });
});

describe('cleanName', () => {
  it('quita espacios de más y recorta', () => {
    expect(cleanName('  Casa   de  mamá ')).toBe('Casa de mamá');
    expect(cleanName('x'.repeat(50))).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe('parseProfile', () => {
  it('lee un perfil válido', () => {
    const raw = {
      classes: [{ id: 'a', day: 3, start: { hours: 10, minutes: 30 }, name: 'Cálculo' }],
      places: [
        { id: 'p', name: 'Casa', icon: 'home', coordinate: { latitude: 8.75, longitude: -75.88 } },
      ],
      walking: { pace: 'slow', maxWalkMinutes: 8 },
      notices: { morning: true, departure: false, arrival: true },
    };
    expect(parseProfile(JSON.parse(JSON.stringify(raw)))).toEqual(raw);
  });

  it('descarta lo dañado sin perder lo demás', () => {
    const p = parseProfile({
      classes: [
        { id: 'ok', day: 1, start: { hours: 7, minutes: 0 } },
        { id: 'mal-dia', day: 9, start: { hours: 7, minutes: 0 } },
        { id: 'mal-hora', day: 1, start: { hours: 25, minutes: 0 } },
        'basura',
      ],
      places: [
        { id: 'sin-nombre', name: '  ', coordinate: { latitude: 8, longitude: -75 } },
        { id: 'sin-coord', name: 'Trabajo', coordinate: { latitude: 'x' } },
        { id: 'ok', name: 'Otro', icon: 'nave', coordinate: { latitude: 8.7, longitude: -75.8 } },
      ],
      walking: { pace: 'corriendo', maxWalkMinutes: 99 },
    });
    expect(p.classes.map((c) => c.id)).toEqual(['ok']);
    expect(p.classes[0].name).toBe('');
    expect(p.places.map((x) => x.id)).toEqual(['ok']);
    expect(p.places[0].icon).toBe('other');
    expect(p.walking).toEqual(EMPTY_PROFILE.walking);
  });

  it('limita la cantidad de lugares', () => {
    const places = Array.from({ length: MAX_PLACES + 3 }, (_, i) => ({
      id: String(i),
      name: `L${i}`,
      icon: 'other',
      coordinate: { latitude: 8.7, longitude: -75.8 },
    }));
    expect(parseProfile({ places }).places).toHaveLength(MAX_PLACES);
  });

  it('lanza si no es un objeto', () => {
    expect(() => parseProfile(null)).toThrow();
    expect(() => parseProfile([])).toThrow();
  });
});
