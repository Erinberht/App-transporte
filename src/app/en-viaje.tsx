import { router } from 'expo-router';
import {
  ArrowRight,
  RotateCcw,
  Settings,
  ShieldCheck,
  Square,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { LiveBadge } from '../components/LiveBadge';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { OCCUPANCY_LABEL } from '../data/live';
import { getRouteOrDefault } from '../data/repository';
import { tripOptionFor, useRoutePlan } from '../planner/useRoutePlan';
import { liveShare, useShareStatus } from '../sharing/liveShare';
import { shareMessage, type ShareTone } from '../sharing/messages';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';
import type { Occupancy } from '../types';

const OPTIONS: { value: Occupancy; icon: LucideIcon }[] = [
  { value: 'full', icon: UsersRound },
  { value: 'medium', icon: Users },
  { value: 'empty', icon: UserRound },
];

const TONES: Record<ShareTone, string> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  muted: colors.textMuted,
};

/** Hora actual que se actualiza cada `everyMs` (para "Último envío hace 8 s"). */
function useNow(everyMs: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

// Paso 4 de 5 · "En viaje"
export default function InTripScreen() {
  const { routeId, origin, occupancy, setOccupancy } = useTrip();
  const route = getRouteOrDefault(routeId);
  const boardStopId = tripOptionFor(useRoutePlan(), route.id)?.boardStop.id;
  const share = useShareStatus();
  const message = shareMessage(share, useNow(5_000));
  const active = share.state === 'sharing' || share.state === 'starting';

  return (
    <ScreenLayout
      step={4}
      title="Estás en viaje"
      subtitle={`Ruta ${route.shortName} · Tu recorrido ayuda a otros viajeros.`}
      ctaLabel={active ? 'Dejar de compartir' : 'Continuar'}
      ctaIcon={active ? Square : ArrowRight}
      onCta={() => {
        if (active) liveShare.stop();
        router.push('/alerta-llegada');
      }}
    >
      <View style={styles.live}>
        <View style={styles.liveRow}>
          <View style={styles.liveText}>
            <Text style={[styles.liveTitle, { color: TONES[message.tone] }]}>{message.title}</Text>
            <Text style={styles.liveBody} accessibilityLiveRegion="polite">
              {message.body}
            </Text>
          </View>
          {share.state === 'sharing' && !share.problem ? <LiveBadge /> : null}
        </View>
        {message.action ? (
          <Pressable
            accessibilityRole="button"
            style={styles.action}
            onPress={() =>
              message.action === 'settings' ? Linking.openSettings() : liveShare.retry()
            }
          >
            {message.action === 'settings' ? (
              <Settings size={16} color={colors.primary} />
            ) : (
              <RotateCcw size={16} color={colors.primary} />
            )}
            <Text style={styles.actionText}>
              {message.action === 'settings' ? 'Abrir ajustes' : 'Intentar de nuevo'}
            </Text>
          </Pressable>
        ) : null}
        <RouteMap
          height={228}
          busLabel={route.shortName}
          routeId={route.id}
          origin={origin}
          boardStopId={boardStopId}
        />
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
  liveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  liveText: { flex: 1, gap: 2 },
  liveTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.bodyLg,
    lineHeight: lineHeight(fontSize.bodyLg, 1.4),
    color: colors.success,
  },
  liveBody: {
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.textMuted,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  actionText: { fontFamily: fonts.semibold, fontSize: fontSize.small, color: colors.primary },
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
