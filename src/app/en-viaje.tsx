import { router } from 'expo-router';
import {
  AlertTriangle,
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
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { LiveBadge } from '../components/LiveBadge';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { OCCUPANCY_LABEL } from '../data/live';
import { getRouteOrDefault } from '../data/repository';
import { useNow } from '../lib/useNow';
import { tripOptionFor, useRoutePlan } from '../planner/useRoutePlan';
import { liveShare, useShareStatus } from '../sharing/liveShare';
import { shareMessage, type ShareTone } from '../sharing/messages';
import { INCIDENT_LABEL } from '../sharing/incidentText';
import { occupancyText } from '../sharing/occupancyText';
import type { IncidentReportResult, OccupancyReportResult } from '../sharing/shareSession';
import type { IncidentKind } from '../api/transit';
import { useLiveOccupancy } from '../sharing/useLiveOccupancy';
import { linkedBusFor, useTrip } from '../state/trip';
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

/** Qué decirle al usuario después de tocar Lleno / Medio / Vacío. */
export function reportFeedback(
  result: OccupancyReportResult,
  routeName: string,
): { text: string; tone: ShareTone } {
  switch (result.kind) {
    case 'sent':
      return { text: `Enviado. Lo verán quienes esperan la ${routeName}.`, tone: 'success' };
    case 'too_soon':
      return {
        text: `Ya reportaste hace poco. Podrás actualizarlo en ${result.waitMinutes} min.`,
        tone: 'warning',
      };
    case 'max_reached':
      return { text: 'Ya enviaste el máximo de reportes de este viaje. ¡Gracias!', tone: 'muted' };
    case 'not_sharing':
      return { text: 'El cupo se envía solo mientras compartes tu recorrido.', tone: 'warning' };
    case 'offline':
      return { text: 'Sin conexión: no se envió. Intenta de nuevo.', tone: 'danger' };
  }
}

const INCIDENTS: IncidentKind[] = ['broken_down', 'detour', 'big_delay'];

export function incidentFeedback(
  result: IncidentReportResult,
  routeName: string,
): { text: string; tone: ShareTone } {
  switch (result.kind) {
    case 'sent':
      return {
        text: `Gracias. Avisamos a quienes esperan la ${routeName} y les sugerimos otra ruta.`,
        tone: 'success',
      };
    case 'already_reported':
      return { text: 'Ya lo reportaste en este viaje.', tone: 'muted' };
    case 'not_sharing':
      return { text: 'Solo se puede reportar mientras compartes tu recorrido.', tone: 'warning' };
    case 'offline':
      return { text: 'Sin conexión: no se envió. Intenta de nuevo.', tone: 'danger' };
  }
}

// "En viaje"
export default function InTripScreen() {
  const { routeId, origin, destination, occupancy, setOccupancy, bus: scannedBus } = useTrip();
  const route = getRouteOrDefault(routeId);
  const bus = linkedBusFor(scannedBus, route.id);
  const boardStopId = tripOptionFor(useRoutePlan(), route.id)?.boardStop.id;
  const share = useShareStatus();
  const now = useNow(5_000);
  const message = shareMessage(share, now);
  const active = share.state === 'sharing' || share.state === 'starting';
  const live = useLiveOccupancy();
  const others = (bus && live.byBus[bus.id]) || live.byRoute[route.id];
  const [feedback, setFeedback] = useState<{ text: string; tone: ShareTone } | null>(null);
  const [sending, setSending] = useState(false);
  const [incidentNote, setIncidentNote] = useState<{ text: string; tone: ShareTone } | null>(null);
  // "No, es el tráfico": no volver a preguntar en este viaje.
  const [stuckDismissed, setStuckDismissed] = useState(false);
  const askStuck =
    share.state === 'sharing' &&
    share.stuck &&
    !stuckDismissed &&
    !liveShare.hasReported('broken_down');

  async function reportProblem(kind: IncidentKind) {
    if (sending) return;
    setSending(true);
    const result = await liveShare.reportIncident(kind);
    setSending(false);
    setIncidentNote(incidentFeedback(result, route.shortName));
  }

  async function report(level: Occupancy) {
    if (sending) return;
    setSending(true);
    const result = await liveShare.reportOccupancy(level);
    setSending(false);
    if (result.kind === 'sent') setOccupancy(level);
    setFeedback(reportFeedback(result, route.shortName));
  }

  return (
    <ScreenLayout
      title="Estás en viaje"
      subtitle={`Ruta ${route.shortName}${bus ? ` · Bus ${bus.code}` : ''} · Tu recorrido ayuda a otros viajeros.`}
      ctaLabel={active ? 'Dejar de compartir' : 'Continuar'}
      ctaIcon={active ? Square : ArrowRight}
      onCta={() => {
        if (active) liveShare.stop();
        router.push('/fin-del-viaje');
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
        {askStuck ? (
          <View style={styles.stuck} accessibilityLiveRegion="assertive">
            <AlertTriangle size={18} color={colors.warning} />
            <View style={styles.stuckBody}>
              <Text style={styles.stuckTitle}>El bus lleva 5 min sin moverse. ¿Se varó?</Text>
              <View style={styles.stuckActions}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.action}
                  onPress={() => reportProblem('broken_down')}
                >
                  <Text style={styles.actionText}>Sí, se varó</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.action}
                  onPress={() => setStuckDismissed(true)}
                >
                  <Text style={styles.actionText}>No, es el tráfico</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
        <RouteMap
          height={228}
          busLabel={route.shortName}
          routeId={route.id}
          origin={origin}
          destination={destination}
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
                accessibilityLabel={`${OCCUPANCY_LABEL[value]}${selected ? ', enviado' : ''}`}
                disabled={sending}
                onPress={() => report(value)}
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
        <Text
          style={[styles.confirm, feedback && { color: TONES[feedback.tone] }]}
          accessibilityLiveRegion="polite"
        >
          {feedback?.text ??
            (occupancy
              ? `Reportaste cupo ${OCCUPANCY_LABEL[occupancy].toLowerCase()}`
              : 'Toca una opción para avisar a quienes esperan este bus.')}
        </Text>
        <Text style={styles.confirm}>
          {bus && live.byBus[bus.id] ? 'En este bus: ' : 'En la ruta: '}
          {occupancyText(others, now)}
        </Text>
      </View>

      {share.state === 'sharing' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>¿Pasa algo con el bus?</Text>
          <View style={styles.problems}>
            {INCIDENTS.map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                disabled={sending}
                onPress={() => reportProblem(kind)}
                style={styles.problem}
              >
                <Text style={styles.problemText}>{INCIDENT_LABEL[kind]}</Text>
              </Pressable>
            ))}
          </View>
          <Text
            style={[styles.confirm, incidentNote && { color: TONES[incidentNote.tone] }]}
            accessibilityLiveRegion="polite"
          >
            {incidentNote?.text ?? 'Avisa a quienes esperan esta ruta en las siguientes paradas.'}
          </Text>
        </View>
      ) : null}

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
  problems: { gap: 8 },
  problem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  problemText: { fontFamily: fonts.medium, fontSize: fontSize.body, color: colors.text },
  stuck: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
  },
  stuckBody: { flex: 1, gap: 8 },
  stuckTitle: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.warning },
  stuckActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
