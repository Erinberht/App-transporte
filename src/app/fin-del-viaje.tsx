import { router } from 'expo-router';
import { CircleCheck, Clock3, Radio } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { getRouteOrDefault } from '../data/repository';
import { dateToClassTime, formatClassTime } from '../lib/classTime';
import { resolveArriveBy } from '../planner/recommend';
import { liveShare, useShareStatus } from '../sharing/liveShare';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

const clock = (d: Date) => formatClassTime(dateToClassTime(d));

/** "Llegaste 8 min antes…" / "…justo a tiempo…" / "…5 min tarde…" respecto a la clase. */
export function classArrivalText(arrivedAt: Date, arriveBy: Date): string {
  const margin = Math.floor((arriveBy.getTime() - arrivedAt.getTime()) / 60_000);
  // Muy lejos de la hora de clase (ej. un viaje de regreso): no tiene sentido compararla.
  if (Math.abs(margin) > 120) return `Llegaste a las ${clock(arrivedAt)}`;
  if (margin > 0) return `Llegaste ${margin} min antes de tu clase de las ${clock(arriveBy)}`;
  if (margin === 0) return `Llegaste justo a tiempo a tu clase de las ${clock(arriveBy)}`;
  return `Llegaste ${-margin} min tarde a tu clase de las ${clock(arriveBy)}`;
}

// Cierre del viaje (al dejar de compartir o al detectar que bajaste). Sin anuncios.
export default function TripEndScreen() {
  const { routeId, classTime, reset } = useTrip();
  const route = getRouteOrDefault(routeId);
  const share = useShareStatus();
  const [endedAt] = useState(() => new Date());
  const arriveBy = resolveArriveBy(classTime, endedAt);
  const sharedMinutes =
    share.state === 'ended' && share.sharedMs !== null
      ? Math.max(1, Math.round(share.sharedMs / 60_000))
      : null;
  const autoAlighted = share.state === 'ended' && share.reason === 'auto_alighted';

  return (
    <ScreenLayout
      title={autoAlighted ? 'Bajaste del bus' : 'Viaje terminado'}
      subtitle={
        sharedMinutes !== null ? 'Gracias por compartir tu recorrido.' : 'Gracias por usar Mi bus.'
      }
      ctaLabel="Listo"
      onCta={() => {
        reset();
        liveShare.reset();
        router.replace('/');
      }}
    >
      <View style={styles.done}>
        <CircleCheck size={28} color={colors.success} />
        <Text style={styles.doneText}>{classArrivalText(endedAt, arriveBy)}</Text>
      </View>

      <RouteMap height={170} routeId={route.id} />

      <View style={styles.card}>
        <View style={styles.row}>
          <Clock3 size={18} color={colors.textMuted} />
          <Text style={styles.rowText}>
            Ruta {route.shortName} · terminaste a las {clock(endedAt)}
          </Text>
        </View>
        <View style={styles.row}>
          <Radio size={18} color={colors.textMuted} />
          <Text style={styles.rowText}>
            {sharedMinutes !== null
              ? `Compartiste ${sharedMinutes} min. Tu ubicación ya no se envía.`
              : 'No compartiste tu ubicación en este viaje.'}
          </Text>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  doneText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSize.lead,
    lineHeight: lineHeight(fontSize.lead, 1.35),
    color: colors.success,
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight(fontSize.body),
    color: colors.text,
  },
});
