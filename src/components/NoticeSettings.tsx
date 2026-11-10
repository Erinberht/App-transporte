import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { DEPARTURE_LEAD_MINUTES } from '../notifications/plan';
import { requestNoticePermission } from '../notifications/scheduler';
import type { NoticePrefs } from '../profile/model';
import { profileStore, useProfile } from '../profile/store';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

const OPTIONS: { key: keyof NoticePrefs; title: string; detail: string }[] = [
  {
    key: 'morning',
    title: 'Sugerencia de la mañana',
    detail: 'Ruta y hora de salida para tu primera clase del día.',
  },
  {
    key: 'departure',
    title: 'Hora de salir',
    detail: `“Sal en ${DEPARTURE_LEAD_MINUTES} min para llegar a tu clase”.`,
  },
  {
    key: 'arrival',
    title: 'Tu bus se acerca',
    detail: 'Mientras esperas, con tiempo para caminar a la parada.',
  },
];

// Sección "Avisos" de Mi perfil (etapa 4.2a). Todos apagados por defecto; el permiso de
// notificaciones se pide solo al activar uno. Los avisos se programan en el teléfono.
export function NoticeSettings() {
  const { notices, places, classes } = useProfile();
  const [denied, setDenied] = useState(false);
  const hasHome = places.some((p) => p.icon === 'home');
  const dailyOn = notices.morning || notices.departure;

  const toggle = async (key: keyof NoticePrefs, value: boolean) => {
    if (value && !(await requestNoticePermission())) {
      setDenied(true);
      return;
    }
    setDenied(false);
    profileStore.setNotices({ ...profileStore.get().notices, [key]: value });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Avisos</Text>
      {OPTIONS.map((option) => (
        <View key={option.key} style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.title}>{option.title}</Text>
            <Text style={styles.detail}>{option.detail}</Text>
          </View>
          <Switch
            accessibilityLabel={option.title}
            value={notices[option.key]}
            onValueChange={(value) => toggle(option.key, value)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
      ))}
      {denied ? (
        <Text style={[styles.note, { color: colors.danger }]}>
          Mi bus no tiene permiso para enviarte notificaciones. Actívalo en los Ajustes del
          teléfono.
        </Text>
      ) : null}
      {dailyOn && classes.length === 0 ? (
        <Text style={styles.note}>Agrega tu horario de clases para recibir estos avisos.</Text>
      ) : null}
      {dailyOn && !hasHome ? (
        <Text style={styles.note}>
          Guarda un lugar de tipo Casa para saber a qué hora salir. Sin Casa solo te recordamos la
          hora de la clase.
        </Text>
      ) : null}
      <Text style={styles.note}>
        Las horas salen del horario de las rutas cargadas y pueden variar unos minutos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lead, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.bodyLg, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
  note: {
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.textMuted,
  },
});
