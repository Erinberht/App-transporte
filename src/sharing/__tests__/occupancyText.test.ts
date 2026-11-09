import { occupancyText } from '../occupancyText';

describe('occupancyText', () => {
  const now = new Date(2026, 10, 9, 7, 0).getTime();
  it('nivel, hace cuánto y cuántos viajeros', () => {
    expect(
      occupancyText({ level: 'medium', reports: 2, at: new Date(now - 3 * 60_000) }, now),
    ).toBe('Cupo medio · hace 3 min · 2 viajeros');
    expect(occupancyText({ level: 'full', reports: 1, at: new Date(now - 20_000) }, now)).toBe(
      'Cupo lleno · hace menos de 1 min · 1 viajero',
    );
  });

  it('sin reportes no inventa', () => {
    expect(occupancyText(undefined, now)).toBe('Sin reportes de cupo recientes');
  });
});
