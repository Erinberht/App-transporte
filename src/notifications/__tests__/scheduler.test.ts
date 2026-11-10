import * as Notifications from 'expo-notifications';

import { profileStore } from '../../profile/store';
import { arrivalNotice } from '../plan';
import { requestNoticePermission, setArrivalNotice, syncDailyNotices } from '../scheduler';

const scheduled = (Notifications as unknown as { __scheduled: Map<string, unknown> }).__scheduled;
const ids = () => [...scheduled.keys()].sort();
const grant = (granted: boolean) =>
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted } as never);

// Domingo 8 de noviembre de 2026, 8:00 p. m.
const domingo = new Date(2026, 10, 8, 20, 0);

function setUpProfile() {
  profileStore.addClass(1, { hours: 7, minutes: 0 }, 'Cálculo');
  profileStore.savePlace({
    name: 'Casa',
    icon: 'home',
    coordinate: { latitude: 8.759, longitude: -75.879 },
  });
}

describe('avisos programados', () => {
  beforeEach(() => {
    profileStore.clear();
    scheduled.clear();
    grant(false);
  });

  it('sin permiso no programa nada', async () => {
    setUpProfile();
    profileStore.setNotices({ morning: true, departure: true, arrival: false });
    expect(await syncDailyNotices(domingo)).toBe(0);
    expect(ids()).toEqual([]);
  });

  it('con permiso programa la semana y reprogramar no duplica', async () => {
    grant(true);
    setUpProfile();
    profileStore.setNotices({ morning: true, departure: true, arrival: false });

    expect(await syncDailyNotices(domingo)).toBe(2);
    expect(ids()).toEqual(['departure:2026-11-09', 'morning:2026-11-09']);
    const request = scheduled.get('morning:2026-11-09') as Notifications.NotificationRequestInput;
    expect(request.trigger).toMatchObject({ type: 'date', channelId: 'avisos' });
    expect(request.content.title).toBe('Hoy: Cálculo a las 7:00 a. m.');

    await syncDailyNotices(domingo);
    expect(ids()).toHaveLength(2);
  });

  it('al apagar los avisos (o borrar el perfil) se cancelan, sin tocar la alerta de llegada', async () => {
    grant(true);
    setUpProfile();
    profileStore.setNotices({ morning: true, departure: true, arrival: true });
    await syncDailyNotices(domingo);
    await setArrivalNotice(
      arrivalNotice({
        boardAt: new Date(Date.now() + 20 * 60_000),
        now: new Date(),
        walkToStopMinutes: 0,
        routeName: 'T2',
        stopName: 'Calle 41',
      }),
    );
    expect(ids()).toContain('arrival');

    profileStore.setNotices({ morning: false, departure: false, arrival: true });
    await syncDailyNotices(domingo);
    expect(ids()).toEqual(['arrival']);

    profileStore.clear();
    await syncDailyNotices(domingo);
    await setArrivalNotice(null);
    expect(ids()).toEqual([]);
  });

  it('la alerta de llegada solo se programa si el usuario la activó', async () => {
    grant(true);
    const notice = arrivalNotice({
      boardAt: new Date(Date.now() + 20 * 60_000),
      now: new Date(),
      walkToStopMinutes: 0,
      routeName: 'T2',
      stopName: 'Calle 41',
    });
    await setArrivalNotice(notice);
    expect(ids()).toEqual([]);

    profileStore.setNotices({ morning: false, departure: false, arrival: true });
    await setArrivalNotice(notice);
    expect(ids()).toEqual(['arrival']);
  });

  it('pedir permiso', async () => {
    expect(await requestNoticePermission()).toBe(true);
    jest
      .mocked(Notifications.requestPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as never);
    expect(await requestNoticePermission()).toBe(false);
  });
});
