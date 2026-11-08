import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Platform } from 'react-native';

import type { ClassTime } from '../../lib/classTime';
import { ClassTimeField } from '../ClassTimeField';

function Harness({ initial = { hours: 7, minutes: 0 } }: { initial?: ClassTime }) {
  const [value, setValue] = useState(initial);
  return <ClassTimeField value={value} onChange={setValue} />;
}

const picked = (hours: number, minutes: number) => {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
};

describe('ClassTimeField', () => {
  afterEach(() => jest.restoreAllMocks());

  it('iOS: abre el selector debajo del campo y actualiza la hora', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(<Harness />);

    expect(screen.getByText('7:00 a. m.')).toBeOnTheScreen();
    expect(screen.queryByTestId('time-picker')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Cambiar'));
    const picker = screen.getByTestId('time-picker');
    expect(picker.props.mode).toBe('time');

    await fireEvent(picker, 'valueChange', {}, picked(9, 30));
    expect(screen.getByText('9:30 a. m.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Listo'));
    expect(screen.queryByTestId('time-picker')).not.toBeOnTheScreen();
  });

  it('Android: abre el reloj del sistema y guarda la hora elegida', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const open = jest.mocked(DateTimePickerAndroid.open);
    await render(<Harness />);

    await fireEvent.press(screen.getByText('Cambiar'));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ mode: 'time' }));

    const { onValueChange } = open.mock.calls[0][0];
    await act(() =>
      onValueChange?.({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, picked(14, 0)),
    );

    expect(screen.getByText('2:00 p. m.')).toBeOnTheScreen();
  });
});
