import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LiveBadge } from '../components/LiveBadge';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { getRoute, OCCUPANCY_LABEL } from '../data/routes';
import { useTrip } from '../state/trip';
import { colors, radius } from '../theme';
import type { Occupancy } from '../types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const OPTIONS: { value: Occupancy; icon: IconName }[] = [
  { value: 'full', icon: 'account-group-outline' },
  { value: 'medium', icon: 'account-multiple-outline' },
  { value: 'empty', icon: 'account-outline' },
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
      ctaIcon="square-outline"
      onCta={() => {
        // TODO: detener el envío de ubicación (y detectar automáticamente cuando el usuario baja).
        setSharing(false);
        router.push('/alerta-llegada');
      }}
    >
      <View style={styles.liveRow}>
        <Text style={styles.liveTitle}>Compartiendo tu recorrido en vivo</Text>
        <LiveBadge />
      </View>

      <RouteMap height={228} busLabel={route.name} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>¿Cómo va el bus?</Text>
        <View style={styles.options}>
          {OPTIONS.map(({ value, icon }) => {
            const selected = occupancy === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setOccupancy(value)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={20}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.optionLabel, selected && { color: colors.primary }]}>
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
        <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.success} />
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
  liveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTitle: { fontSize: 13, fontWeight: '700', color: colors.success },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  options: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    height: 72,
    gap: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 1.5 },
  optionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  confirm: { fontSize: 11, color: colors.textMuted },
  autoStop: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  autoStopText: { flex: 1, gap: 4 },
  autoStopTitle: { fontSize: 13, fontWeight: '700', color: colors.success },
  autoStopBody: { fontSize: 12, color: colors.success },
});
