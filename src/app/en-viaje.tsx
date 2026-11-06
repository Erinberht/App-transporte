import { router } from 'expo-router';
import {
  ShieldCheck,
  Square,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LiveBadge } from '../components/LiveBadge';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { getRoute, OCCUPANCY_LABEL } from '../data/routes';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';
import type { Occupancy } from '../types';

const OPTIONS: { value: Occupancy; icon: LucideIcon }[] = [
  { value: 'full', icon: UsersRound },
  { value: 'medium', icon: Users },
  { value: 'empty', icon: UserRound },
];

// Paso 4 de 5 · "En viaje"
export default function InTripScreen() {
  const { routeId, occupancy, setOccupancy, setSharing } = useTrip();
  const route = getRoute(routeId);

  return (
    <ScreenLayout
      step={4}
      title="Estás en viaje"
      subtitle={`Ruta ${route.name} · Tu recorrido ayuda a otros viajeros.`}
      ctaLabel="Dejar de compartir"
      ctaIcon={Square}
      onCta={() => {
        // TODO: detener el envío de ubicación (y detectar automáticamente cuando el usuario baja).
        setSharing(false);
        router.push('/alerta-llegada');
      }}
    >
      <View style={styles.live}>
        <View style={styles.liveRow}>
          <Text style={styles.liveTitle}>Compartiendo tu recorrido en vivo</Text>
          <LiveBadge />
        </View>
        <RouteMap height={228} busLabel={route.name} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>¿Cómo va el bus?</Text>
        <View style={styles.options}>
          {OPTIONS.map(({ value, icon: Icon }) => {
            const selected = occupancy === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setOccupancy(value)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Icon size={20} color={selected ? colors.primary : colors.textMuted} />
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                  {OCCUPANCY_LABEL[value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.confirm}>
          Cupo {OCCUPANCY_LABEL[occupancy].toLowerCase()} seleccionado
        </Text>
      </View>

      <View style={styles.autoStop}>
        <ShieldCheck size={20} color={colors.success} />
        <View style={styles.autoStopText}>
          <Text style={styles.autoStopTitle}>Se detiene solo al bajar</Text>
          <Text style={styles.autoStopBody}>
            La ubicación deja de compartirse al terminar tu viaje.
          </Text>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  live: { gap: 12 },
  liveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSize.bodyLg,
    lineHeight: lineHeight(fontSize.bodyLg, 1.4),
    color: colors.success,
  },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: fontSize.title3, color: colors.text },
  options: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    height: 72,
    gap: 7,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  optionLabel: { fontFamily: fonts.medium, fontSize: fontSize.body, color: colors.textMuted },
  optionLabelSelected: { fontFamily: fonts.semibold, color: colors.primary },
  confirm: { fontFamily: fonts.regular, fontSize: fontSize.caption, color: colors.textMuted },
  autoStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  autoStopText: { flex: 1, gap: 4 },
  autoStopTitle: { fontFamily: fonts.semibold, fontSize: fontSize.bodyLg, color: colors.success },
  autoStopBody: {
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.textMuted,
  },
});
