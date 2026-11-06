import { classTimeToDate, dateToClassTime, formatClassTime } from '../classTime';

describe('formatClassTime', () => {
  it.each([
    [{ hours: 7, minutes: 0 }, '7:00 a. m.'],
    [{ hours: 0, minutes: 5 }, '12:05 a. m.'],
    [{ hours: 12, minutes: 0 }, '12:00 p. m.'],
    [{ hours: 14, minutes: 30 }, '2:30 p. m.'],
    [{ hours: 23, minutes: 59 }, '11:59 p. m.'],
  ])('%o -> %s', (time, expected) => {
    expect(formatClassTime(time)).toBe(expected);
  });
});

describe('conversión con Date', () => {
  it('ida y vuelta conserva la hora', () => {
    const time = { hours: 18, minutes: 45 };
    expect(dateToClassTime(classTimeToDate(time))).toEqual(time);
  });

  it('usa el día de la fecha base, con segundos en cero', () => {
    const date = classTimeToDate({ hours: 6, minutes: 30 }, new Date(2026, 10, 6, 22, 10, 33));
    expect(date.getFullYear()).toBe(2026);
    expect(date.getDate()).toBe(6);
    expect(date.getHours()).toBe(6);
    expect(date.getMinutes()).toBe(30);
    expect(date.getSeconds()).toBe(0);
  });
});
