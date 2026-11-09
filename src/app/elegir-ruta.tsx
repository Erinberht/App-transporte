import { router } from 'expo-router';
import { ArrowRight, BusFront, Check, Footprints, MapPinOff } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '../components/AdBanner';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { SAMPLE_ADS } from '../data/ads';
import { routesRepository } from '../data/repository';
import { dateToClassTime, formatClassTime } from '../lib/classTime';
import { useNow } from '../lib/useNow';
import {
  arrivalLabel,
  unavailableLabel,
  type ArrivalStatus,
  type RouteOption,
} from '../planner/recommend';
import { tripOptionFor, useRoutePlan } from '../planner/useRoutePlan';
import { blockedRoutes } from '../planner/disruption';
import { incidentText } from '../sharing/incidentText';
import { occupancyText } from '../sharing/occupancyText';
import { useLiveIncidents } from '../sharing/useLiveIncidents';
import { useLiveOccupancy } from '../sharing/useLiveOccupancy';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, radius } from '../theme';

const clock = (d: Date) => formatClassTime(dateToClassTime(d));

const STATUS_COLORS: Record<ArrivalStatus, { fg: string; bg: string }> = {
  early: { fg: colors.success, bg: colors.successSoft },
  just: { fg: colors.warning, bg: colors.warningSoft },
  late: { fg: colors.danger, bg: colors.dangerSoft },
};

// "Elegir ruta"
export default function ChooseRouteScreen() {
  const { routeId, origin, setRouteId } = useTrip();
  const plan = useRoutePlan();
  const routes = routesRepository.listRoutes();
  const ordered: { routeId: string; option?: RouteOption }[] = plan
    ? plan.options.map((option) => ({ routeId: option.routeId, option }))
    : routes.map((r) => ({ routeId: r.id }));
  const incidents = useLiveIncidents();
  const blocked = blockedRoutes(incidents);
  // La recomendada: la primera que no tenga una buseta varada o desviada reportada.
  const best = plan?.options.find(
    (o): o is Extract<typeof o, { kind: 'trip' }> => o.kind === 'trip' && !blocked.has(o.routeId),
  );
  const selectedOption = tripOptionFor(plan, routeId);
  const occupancy = useLiveOccupancy().byRoute;
  const now = useNow(30_000);

  // Preseleccionar la mejor ruta, salvo que el usuario ya haya elegido otra en esta pantalla.
  const userPicked = useRef(false);
  useEffect(() => {
    if (best && !userPicked.current) setRouteId(best.routeId);
  }, [best, setRouteId]);

  return (
    <ScreenLayout
      title="Elige tu ruta"
      subtitle="Encuentra tu bus y viaja con más certeza."
      footerNote="Selecciona una ruta para ver su recorrido."
      ctaLabel="Ver mi bus"
      ctaIcon={ArrowRight}
      onCta={() => router.push('/bus-en-el-mapa')}
    >
      <RouteMap
        height={164}
        routeId={routeId}
        origin={origin}
        boardStopId={selectedOption?.boardStop.id}
      />

      {!plan ? (
        <View style={styles.hint}>
          <MapPinOff size={18} color={colors.textMuted} />
          <Text style={styles.hintText}>
            Activa tu ubicación para ver a qué hora llegas con cada ruta.
          </Text>
        </View>
      ) : null}

      {plan?.walkInstead ? (
        <View style={[styles.hint, { backgroundColor: colors.successSoft }]}>
          <Footprints size={18} color={colors.success} />
          <Text style={[styles.hintText, { color: colors.success }]}>
            Te conviene ir caminando: {plan.walkInstead.minutes} min, llegas a las{' '}
            {clock(plan.walkInstead.arriveAt)}.
          </Text>
        </View>
      ) : null}

      {best?.latestLeaveAt ? (
        <View style={[styles.hint, { backgroundColor: colors.primarySoft }]}>
          <Footprints size={18} color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.primary }]}>
            Tienes tiempo: sal a más tardar a las {clock(best.latestLeaveAt)} para tomar la{' '}
            {routesRepository.getRoute(best.routeId)?.shortName}.
          </Text>
        </View>
      ) : null}

      <View style={styles.list}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Rutas disponibles</Text>
          <Text style={styles.listCount}>
            {plan ? `Para tu clase de las ${clock(plan.arriveBy)}` : `${routes.length} rutas`}
          </Text>
        </View>

        {ordered.map(({ routeId: id, option }) => {
          const route = routesRepository.getRoute(id);
          if (!route) return null;
          const selected = id === routeId;
          const trip = option?.kind === 'trip' ? option : undefined;
          const unavailable = option?.kind === 'unavailable' ? option : undefined;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={[
                `Ruta ${route.shortName}, ${route.longName}`,
                trip ? arrivalLabel(trip) : unavailable ? unavailableLabel(unavailable) : null,
              ]
                .filter(Boolean)
                .join('. ')}
              accessibilityState={{ selected }}
              onPress={() => {
                userPicked.current = true;
                setRouteId(id);
              }}
              style={[
                styles.option,
                selected && styles.optionSelected,
                unavailable && !selected && styles.optionDimmed,
              ]}
            >
              <View style={[styles.badge, selected && styles.badgeSelected]}>
                <BusFront size={20} color={selected ? colors.onPrimary : colors.textMuted} />
              </View>
              <View style={styles.optionText}>
                <View style={styles.titleRow}>
                  <Text style={styles.routeName}>{route.shortName}</Text>
                  {trip ? (
                    <View style={[styles.tag, { backgroundColor: STATUS_COLORS[trip.status].bg }]}>
                      <Text style={[styles.tagText, { color: STATUS_COLORS[trip.status].fg }]}>
                        {arrivalLabel(trip)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.longName} numberOfLines={1}>
                  {route.longName}
                </Text>
                {trip ? (
                  <Text style={styles.detail}>
                    Sube en {trip.boardStop.name} a las {clock(trip.boardAt)} · llegas{' '}
                    {clock(trip.arriveAt)}
                  </Text>
                ) : null}
                {trip ? (
                  <Text style={styles.detailMuted}>
                    {trip.walkToStopMinutes} min a pie · {trip.rideMinutes} min en bus ·{' '}
                    {trip.walkFromStopMinutes} min al campus
                  </Text>
                ) : null}
                {unavailable ? (
                  <Text style={styles.detailMuted}>{unavailableLabel(unavailable)}</Text>
                ) : null}
                {incidents
                  .filter((i) => i.routeId === id)
                  .map((i) => (
                    <Text key={i.kind} style={styles.incident}>
                      ⚠ {incidentText(i, route.shortName, now)}
                    </Text>
                  ))}
                {occupancy[id] ? (
                  <Text style={styles.detailMuted}>{occupancyText(occupancy[id], now)}</Text>
                ) : null}
                {selected ? <Text style={styles.selectedText}>Ruta seleccionada</Text> : null}
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <Check size={12} color={colors.onPrimary} strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Anuncio de muestra (modelo de negocio futuro) */}
      <AdBanner ad={SAMPLE_ADS[0]} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 3,
  },
  listTitle: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.text },
  listCount: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 70,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  optionDimmed: { opacity: 0.6 },
  badge: {
    width: 37,
    height: 37,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSelected: { backgroundColor: colors.primary },
  optionText: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  routeName: { fontFamily: fonts.semibold, fontSize: fontSize.lead, color: colors.text },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.chip },
  tagText: { fontFamily: fonts.semibold, fontSize: fontSize.caption },
  longName: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
  detail: { fontFamily: fonts.medium, fontSize: fontSize.small, color: colors.text },
  incident: { fontFamily: fonts.medium, fontSize: fontSize.caption, color: colors.danger },
  detailMuted: { fontFamily: fonts.regular, fontSize: fontSize.caption, color: colors.textMuted },
  selectedText: { fontFamily: fonts.regular, fontSize: fontSize.caption, color: colors.primary },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
