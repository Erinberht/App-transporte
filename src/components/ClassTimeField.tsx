import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Clock3, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  classTimeToDate,
  dateToClassTime,
  formatClassTime,
  type ClassTime,
} from '../lib/classTime';
import { colors, fonts, fontSize, radius } from '../theme';

type Props = {
  value: ClassTime;
  onChange: (value: ClassTime) => void;
  /** Texto sobre la hora; "Entrada a clase" por defecto (otro destino: "Llegada"). */
  caption?: string;
};

const WEB_STEP_MINUTES = 15;

function shift({ hours, minutes }: ClassTime, delta: number): ClassTime {
  const total = (((hours * 60 + minutes + delta) % 1440) + 1440) % 1440;
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

// Campo de hora ("Hora de entrada a clase" o de llegada). Android abre el reloj del sistema; iOS muestra un selector
// debajo del campo. En web (sin selector nativo) se ajusta con botones de ±15 min.
export function ClassTimeField({ value, onChange, caption = 'Entrada a clase' }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const label = formatClassTime(value);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: classTimeToDate(value),
        mode: 'time',
        is24Hour: false,
        onValueChange: (_event, date) => onChange(dateToClassTime(date)),
      });
    } else if (Platform.OS === 'ios') {
      setIosOpen((v) => !v);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hora de ${caption.toLowerCase()}: ${label}. Cambiar`}
        onPress={open}
        style={styles.row}
      >
        <Clock3 size={22} color={colors.primary} />
        <View style={styles.text}>
          <Text style={styles.caption}>{caption}</Text>
          <Text style={styles.value}>{label}</Text>
        </View>
        {Platform.OS === 'web' ? (
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${WEB_STEP_MINUTES} minutos antes`}
              onPress={() => onChange(shift(value, -WEB_STEP_MINUTES))}
              style={styles.stepButton}
            >
              <Minus size={18} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${WEB_STEP_MINUTES} minutos después`}
              onPress={() => onChange(shift(value, WEB_STEP_MINUTES))}
              style={styles.stepButton}
            >
              <Plus size={18} color={colors.primary} />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.action}>{iosOpen ? 'Listo' : 'Cambiar'}</Text>
        )}
      </Pressable>

      {Platform.OS === 'ios' && iosOpen ? (
        <DateTimePicker
          value={classTimeToDate(value)}
          mode="time"
          display="spinner"
          locale="es-CO"
          minuteInterval={5}
          onValueChange={(_event, date) => onChange(dateToClassTime(date))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  text: { flex: 1, gap: 3 },
  caption: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
  value: { fontFamily: fonts.semibold, fontSize: fontSize.title3, color: colors.text },
  action: { fontFamily: fonts.semibold, fontSize: fontSize.bodyLg, color: colors.primary },
  stepper: { flexDirection: 'row', gap: 8 },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
