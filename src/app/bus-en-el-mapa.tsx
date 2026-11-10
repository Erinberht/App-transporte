import { router } from 'expo-router';
import { AlertTriangle, BusFront, Check, Clock3, Radio, Search, Users } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '../components/AdBanner';
import { Button } from '../components/Button';
import { LiveBadge } from '../components/LiveBadge';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { SAMPLE_ADS } from '../data/ads';
import { getLiveStatus } from '../data/live';
import { getRouteOrDefault, routesRepository } from '../data/repository';
import { dateToClassTime, formatClassTime } from '../lib/classTime';
import { useNow } from '../lib/useNow';
import { assessWaiting } from '../planner/disruption';
import { nextLiveArrival } from '../planner/liveEta';
import { arrivalLabel, type ArrivalStatus } from '../planner/recommend';
import { tripOptionFor, useRoutePlan } from '../planner/useRoutePlan';
import { incidentText } from '../sharing/incidentText';
import { occupancyText } from '../sharing/occupancyText';
import { useLiveBuses } from '../sharing/useLiveBuses';
import { useLiveIncidents } from '../sharing/useLiveIncidents';
import { useLiveOccupancy } from '../sharing/useLiveOccupancy';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

const clock = (d: Date) => formatClassTime(dateToClassTime(d));

const STATUS_COLORS: Record<ArrivalStatus, { fg: string; bg: string }> = {
  early: { fg: colors.success, bg: colors.successSoft },
  just: { fg: colors.warning, bg: colors.warningSoft },
  late: { fg: colors.danger, bg: colors.dangerSoft },
};

// "Esperando tu bus": dónde va el bus, cuándo pasa por tu parada y si así llegas a tiempo.
// Con viajeros compartiendo, la hora es en vivo; si alguien reporta que la buseta se varó, se
// desvió o va muy retrasada, se avisa y se sugiere la mejor otra ruta. Al subir, "Ya subí".
export default function BusOnMapScreen() {
  const { routeId, origin, destination, setRouteId } = useTrip();
  const route = getRouteOrDefault(routeId);
  const plan = useRoutePlan();
  const option = tripOptionFor(plan, route.id);
  const verified = routesRepository.getPattern(route.id)?.quality === 'verificado';
  const liveBuses = useLiveBuses(route.id);
  const travelers = liveBuses.reduce((sum, b) => sum + b.travelers, 0);
  const now = useNow(15_000);
  const occupancy = useLiveOccupancy().byRoute[route.id];
  const allIncidents = useLiveIncidents();

  // Con ubicación: horario del motor de recomendación, corregido con los buses en vivo.
  // Sin ubicación no hay parada de subida: hora de muestra.
  const situation =
    option && plan
      ? assessWaiting({
          option,
          plan,
          liveEtaMinutes: nextLiveArrival(
            liveBuses,
            routesRepository.getPattern(route.id)?.shape ?? [],
            routesRepository.getPatternStops(route.id),
            option.boardStop,
            option.walkToStopMinutes,
          ),
          incidents: allIncidents,
          now,
        })
      : null;
  const incidents = situation?.incidents ?? allIncidents.filter((i) => i.routeId === route.id);
  const etaMinutes = situation?.etaMinutes ?? getLiveStatus(route.id).etaMinutes;
  const status = situation ? STATUS_COLORS[situation.status] : null;
  const alternative = situation?.alternative;
  const altRoute = alternative ? getRouteOrDefault(alternative.routeId) : null;

  return (
    <ScreenLayout
      title="Esperando tu bus"
      subtitle={
        option
          ? `Ruta ${route.shortName} · Súbete en ${option.boardStop.name}.`
          : `Ruta ${route.shortName} · Sigue el recorrido hasta tu parada.`
      }
      footerNote="Cuando estés a bordo, confirma para continuar."
      ctaLabel="Ya subí"
      ctaIcon={Check}
      onCta={() => router.push('/compartir')}
      gap={14}
    >
      {incidents.map((incident) => (
        <View
          key={incident.kind}
          style={styles.notice}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <AlertTriangle size={18} color={colors.danger} />
          <Text style={styles.noticeText}>{incidentText(incident, route.shortName, now)}</Text>
        </View>
      ))}

      <RouteMap
        height={250}
        busLabel={route.shortName}
        routeId={route.id}
        origin={origin}
        destination={destination}
        boardStopId={option?.boardStop.id}
        liveBuses={liveBuses.map(({ latitude, longitude }) => ({ latitude, longitude }))}
      />

      <View style={styles.arrival}>
        <View style={styles.row}>
          <View style={styles.routeId}>
            <BusFront size={20} color={colors.text} />
            <Text style={styles.routeName}>{route.shortName}</Text>
          </View>
          {situation?.live ? <LiveBadge /> : null}
        </View>
        <View style={styles.row}>
          <Text style={styles.eta}>
            {etaMinutes === 0 ? 'Está llegando' : `Llega en ${etaMinutes} min`}
          </Text>
          <Clock3 size={24} color={colors.success} />
        </View>
        {situation && status ? (
          <View style={styles.row}>
            <Text style={styles.detail}>
              Pasa a las {clock(situation.boardAt)} · llegas {clock(situation.arriveAt)}
            </Text>
            <View style={[styles.tag, { backgroundColor: status.bg }]}>
              <Text style={[styles.tagText, { color: status.fg }]}>{arrivalLabel(situation)}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.liveSource}>
          <Users size={16} color={occupancy ? colors.primary : colors.textMuted} />
          <Text style={[styles.liveSourceText, occupancy && styles.occupancyText]}>
            {occupancyText(occupancy, now)}
          </Text>
        </View>
        <View style={styles.liveSource}>
          <Radio size={16} color={liveBuses.length ? colors.success : colors.textMuted} />
          <Text style={styles.liveSourceText}>
            {liveBuses.length
              ? `Posición en vivo · ${travelers === 1 ? '1 viajero comparte' : `${travelers} viajeros comparten`}`
              : 'Nadie comparte esta ruta ahora · posición estimada'}
          </Text>
        </View>
      </View>

      {situation?.delayMinutes ? (
        <View style={styles.late} accessibilityLiveRegion="polite">
          <Clock3 size={18} color={colors.danger} />
          <Text style={styles.lateText}>
            {`Posible retraso: según los viajeros, el bus pasa en ${situation.etaMinutes} min, unos ${situation.delayMinutes} min más tarde de lo que dice el horario.`}
          </Text>
        </View>
      ) : null}

      {situation?.status === 'late' ? (
        <View style={styles.late} accessibilityLiveRegion="polite">
          <AlertTriangle size={18} color={colors.danger} />
          <Text style={styles.lateText}>
            Con este bus llegas tarde {destination.kind === 'campus' ? 'a tu clase de' : 'para'} las{' '}
            {clock(plan!.arriveBy)}.
          </Text>
        </View>
      ) : null}

      {alternative && altRoute ? (
        <View style={styles.alternative}>
          <Text style={styles.altTitle}>Mejor alternativa: ruta {altRoute.shortName}</Text>
          <Text style={styles.detail}>
            {`Sube en ${alternative.boardStop.name} a las ${clock(alternative.boardAt)} · llegas ${clock(alternative.arriveAt)} · ${arrivalLabel(alternative)}`}
          </Text>
          <Button
            label={`Cambiar a ${altRoute.shortName}`}
            onPress={() => setRouteId(alternative.routeId)}
          />
        </View>
      ) : null}

      <Button
        label="Buscar otra ruta"
        icon={Search}
        variant="outline"
        onPress={() => router.navigate('/elegir-ruta')}
      />

      <View style={styles.legend}>
        <Text style={styles.legendDots}>•••••</Text>
        <Text style={styles.legendText}>
          {verified ? 'Recorrido de la ruta' : 'Recorrido aproximado (datos de prueba)'}
        </Text>
      </View>

      {/* Anuncio de muestra (modelo de negocio futuro). Nunca en "En viaje". */}
      <AdBanner ad={SAMPLE_ADS[2]} variant="card" />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.body, color: colors.danger },
  arrival: {
    padding: 16,
    gap: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  routeId: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeName: { fontFamily: fonts.bold, fontSize: fontSize.heading, color: colors.text },
  eta: { fontFamily: fonts.bold, fontSize: fontSize.eta, color: colors.success },
  detail: { fontFamily: fonts.medium, fontSize: fontSize.small, color: colors.text },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.chip },
  tagText: { fontFamily: fonts.semibold, fontSize: fontSize.caption },
  alternative: {
    gap: 10,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  altTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lead, color: colors.primary },
  liveSource: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveSourceText: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
  occupancyText: { fontFamily: fonts.medium, color: colors.text },
  late: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  lateText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSize.body,
    lineHeight: lineHeight(fontSize.body),
    color: colors.danger,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDots: { fontFamily: fonts.regular, fontSize: fontSize.caption, color: colors.route },
  legendText: { fontFamily: fonts.regular, fontSize: fontSize.caption, color: colors.textMuted },
});
