import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import BusOnMapScreen from '../app/bus-en-el-mapa';
import ShareTripScreen from '../app/compartir';
import ChooseRouteScreen from '../app/elegir-ruta';
import WhereToScreen from '../app/index';
import PlaceScreen from '../app/lugar';
import ProfileScreen from '../app/perfil';
import { profileStore } from '../profile/store';
import { TripProvider } from '../state/trip';

function TestLayout() {
  return (
    <TripProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </TripProvider>
  );
}

const routes = {
  _layout: TestLayout,
  index: WhereToScreen,
  perfil: ProfileScreen,
  lugar: PlaceScreen,
  'elegir-ruta': ChooseRouteScreen,
  'bus-en-el-mapa': BusOnMapScreen,
  compartir: ShareTripScreen,
};

const scheduled = (Notifications as unknown as { __scheduled: Map<string, unknown> }).__scheduled;

const open = (initialUrl: string) => renderRouter(routes, { initialUrl });

describe('Perfil del estudiante', () => {
  beforeEach(() => {
    profileStore.clear();
    // Lunes 9 de noviembre de 2026, 12:00 m.
    jest.useFakeTimers({ now: new Date(2026, 10, 9, 12, 0), advanceTimers: true });
  });
  afterEach(() => jest.useRealTimers());

  it('sin perfil: solo la universidad y una invitación a guardar el horario', async () => {
    await open('/');
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByText(/Guarda tu horario en/)).toBeOnTheScreen();
    expect(screen.queryByText(/Próxima clase/)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText(/^Mi perfil:/));
    expect(screen).toHavePathname('/perfil');
  });

  it('propone el destino y la hora de la próxima clase de hoy', async () => {
    profileStore.addClass(1, { hours: 7, minutes: 0 }, 'Ya pasó');
    profileStore.addClass(1, { hours: 14, minutes: 0 }, 'Cálculo');
    profileStore.addClass(2, { hours: 9, minutes: 0 }, 'Mañana');
    await open('/');

    expect(screen.getByText('Próxima clase hoy: Cálculo')).toBeOnTheScreen();
    expect(screen.getByText('2:00 p. m.')).toBeOnTheScreen(); // el campo de hora
    expect(screen.getByText('Hora de entrada a clase')).toBeOnTheScreen();
    expect(screen.queryByText(/Guarda tu horario en/)).not.toBeOnTheScreen();
  });

  it('los lugares guardados son destinos y cambian la pregunta de la hora', async () => {
    profileStore.savePlace({
      name: 'Casa',
      icon: 'home',
      coordinate: { latitude: 8.75, longitude: -75.88 },
    });
    await open('/');

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    await fireEvent.press(screen.getByText('Casa'));
    expect(screen.getByText('¿A qué hora quieres llegar a Casa?')).toBeOnTheScreen();
    expect(screen.getByText('Llegada')).toBeOnTheScreen();
  });

  it('avisa cuando ninguna ruta llega cerca del lugar elegido', async () => {
    profileStore.savePlace({
      name: 'Finca',
      icon: 'other',
      coordinate: { latitude: 8.6, longitude: -76.05 },
    });
    await open('/');
    await fireEvent.press(screen.getByText('Finca'));
    await fireEvent.press(screen.getByText('Permitir ubicación'));
    await screen.findByText('Ubicación actual detectada');
    await fireEvent.press(screen.getByText('Buscar rutas'));

    expect(
      await screen.findByText('Ninguna de las rutas cargadas llega cerca de Finca.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Para llegar a las 7:00 a. m.')).toBeOnTheScreen();
  });

  it('el horario se edita por día', async () => {
    await open('/perfil');
    expect(screen.getByText('Sin clases el lunes.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Agregar clase el lunes'));
    expect(profileStore.get().classes).toMatchObject([{ day: 1, start: { hours: 7, minutes: 0 } }]);
    expect(screen.getByText('7:00 a. m.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Nombre de la clase'), 'Cálculo');
    expect(profileStore.get().classes[0].name).toBe('Cálculo');

    // La siguiente se sugiere 2 h después.
    await fireEvent.press(screen.getByText('Agregar clase el lunes'));
    expect(profileStore.get().classes[1].start).toEqual({ hours: 9, minutes: 0 });

    await fireEvent.press(screen.getByRole('tab', { name: /martes/ }));
    expect(screen.getByText('Sin clases el martes.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: /lunes/ }));
    await fireEvent.press(screen.getByLabelText('Quitar la clase de las 9:00'));
    expect(profileStore.get().classes).toHaveLength(1);
  });

  it('las opciones de caminata se guardan en el perfil', async () => {
    await open('/perfil');
    await fireEvent.press(screen.getByRole('radio', { name: 'Lento' }));
    await fireEvent.press(screen.getByRole('radio', { name: '8 min' }));
    expect(profileStore.get().walking).toEqual({ pace: 'slow', maxWalkMinutes: 8 });
  });

  it('"Borrar mi perfil" pide confirmación y borra todo', async () => {
    profileStore.addClass(1, { hours: 7, minutes: 0 });
    profileStore.savePlace({
      name: 'Casa',
      icon: 'home',
      coordinate: { latitude: 8.75, longitude: -75.88 },
    });
    await open('/perfil');

    await fireEvent.press(screen.getByText('Borrar mi perfil'));
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(profileStore.get().places).toHaveLength(1);

    await fireEvent.press(screen.getByText('Borrar mi perfil'));
    await fireEvent.press(screen.getByText('Sí, borrar mi perfil'));
    expect(profileStore.get().classes).toEqual([]);
    expect(profileStore.get().places).toEqual([]);
    expect(screen.queryByText('Casa')).not.toBeOnTheScreen();
  });

  it('guardar un lugar con la ubicación actual', async () => {
    await open('/lugar');

    // Sin ubicación no se puede guardar.
    await fireEvent.press(screen.getByText('Guardar lugar'));
    expect(
      screen.getByText('Marca el lugar en el mapa o usa tu ubicación actual.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Usar mi ubicación actual'));
    await fireEvent.changeText(screen.getByLabelText('Nombre del lugar'), '  Donde mi tía ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Otro' }));
    await fireEvent.press(screen.getByText('Guardar lugar'));

    expect(profileStore.get().places).toEqual([
      {
        id: expect.any(String),
        name: 'Donde mi tía',
        icon: 'other',
        coordinate: { latitude: 8.759, longitude: -75.879 },
      },
    ]);
  });

  it('sin nombre usa el del tipo, y avisa si ninguna ruta pasa cerca', async () => {
    const id = profileStore.savePlace({
      name: 'Finca',
      icon: 'work',
      coordinate: { latitude: 8.6, longitude: -76.05 },
    })!;
    await open(`/lugar?id=${id}`);

    expect(screen.getByText('Editar lugar')).toBeOnTheScreen();
    expect(screen.getByText(/Ninguna de las rutas cargadas pasa cerca/)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Nombre del lugar'), '');
    await fireEvent.press(screen.getByText('Guardar lugar'));
    expect(profileStore.get().places).toMatchObject([{ id, name: 'Trabajo', icon: 'work' }]);
  });

  it('avisos: se activan uno por uno y piden permiso al activarlos', async () => {
    await open('/perfil');
    expect(screen.getByRole('switch', { name: 'Hora de salir' })).toHaveProp('value', false);

    await fireEvent(screen.getByRole('switch', { name: 'Hora de salir' }), 'valueChange', true);
    await waitFor(() => expect(profileStore.get().notices.departure).toBe(true));
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(screen.getByText(/Guarda un lugar de tipo Casa/)).toBeOnTheScreen();

    jest
      .mocked(Notifications.requestPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as never);
    await fireEvent(screen.getByRole('switch', { name: 'Tu bus se acerca' }), 'valueChange', true);
    expect(
      await screen.findByText(/no tiene permiso para enviarte notificaciones/),
    ).toBeOnTheScreen();
    expect(profileStore.get().notices.arrival).toBe(false);
  });

  it('la alerta de llegada se programa al esperar el bus y se cancela al subir', async () => {
    scheduled.clear();
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as never);
    profileStore.setNotices({ morning: false, departure: false, arrival: true });
    // 4:30 a. m.: el primer bus pasa en un buen rato, hay tiempo para avisar.
    jest.setSystemTime(new Date(2026, 10, 9, 4, 30));

    await open('/');
    await fireEvent.press(screen.getByText('Permitir ubicación'));
    await screen.findByText('Ubicación actual detectada');
    await fireEvent.press(screen.getByText('Buscar rutas'));
    await fireEvent.press(await screen.findByText('Ver mi bus'));

    await waitFor(() => expect(scheduled.has('arrival')).toBe(true));
    const request = scheduled.get('arrival') as Notifications.NotificationRequestInput;
    expect(request.content.title).toMatch(/^Tu \w+ se acerca$/);

    await fireEvent.press(screen.getByText('Ya subí'));
    await waitFor(() => expect(scheduled.has('arrival')).toBe(false));
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as never);
  });
});
