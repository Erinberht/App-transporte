import { router } from 'expo-router';
import { ChevronRight, CircleCheck, QrCode, Radio, ShieldCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { getRouteOrDefault, routesRepository } from '../data/repository';
import { tripOptionFor, useRoutePlan } from '../planner/useRoutePlan';
import { liveShare } from '../sharing/liveShare';
import { linkedBusFor, useTrip } from '../state/trip';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

// "Compartir recorrido"
export default function ShareTripScreen() {
  const { routeId, origin, bus: scannedBus } = useTrip();
  const route = getRouteOrDefault(routeId);
  const bus = linkedBusFor(scannedBus, route.id);
  const option = tripOptionFor(useRoutePlan(), route.id);
  const boardStopId = option?.boardStop.id;

  return (
    <ScreenLayout
      title={`¿Subiste al bus ${route.shortName}?`}
      subtitle="Ayuda a quienes también esperan esta ruta."
      footerNote="Comparte tu recorrido, no tu identidad."
      ctaLabel="Compartir"
      ctaIcon={Radio}
      onCta={() => {
        const stops = routesRepository.getPatternStops(route.id);
        // Empieza en segundo plano: "En viaje" muestra el avance (permisos, conexión...).
        liveShare.start({
          routeId: route.id,
          label: `Ruta ${route.shortName}`,
          path: routesRepository.getPattern(route.id)?.shape ?? [],
          alightStop: (option?.alightStop ?? stops[stops.length - 1])?.coordinate ?? null,
          busId: bus?.id ?? null,
        });
        router.push('/en-viaje');
      }}
      gap={18}
    >
      <RouteMap
        height={158}
        busLabel={route.shortName}
        routeId={route.id}
        origin={origin}
        boardStopId={boardStopId}
      />

      <View style={styles.shareCard}>
        <View style={styles.shareTop}>
          <View style={styles.shareIcon}>
            <Radio size={24} color={colors.success} />
          </View>
          <Text style={styles.shareTitle}>Compartir mi recorrido</Text>
        </View>
        <Text style={styles.shareBody}>
          Tu ubicación en vivo permite mostrar dónde va el bus {route.shortName}.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          bus ? `Bus ${bus.code} vinculado. Escanear otro QR` : 'Escanear el QR del bus, opcional'
        }
        style={[styles.qr, bus && styles.qrLinked]}
        onPress={() => router.push('/escanear-qr')}
      >
        {bus ? (
          <CircleCheck size={32} color={colors.success} />
        ) : (
          <QrCode size={32} color={colors.primary} />
        )}
        <View style={styles.qrText}>
          <Text style={styles.qrTitle}>{bus ? `Bus ${bus.code}` : 'Escanear el QR del bus'}</Text>
          <Text style={styles.qrSub}>
            {bus ? 'Vinculado · Toca para escanear otro' : 'Opcional · Puedes continuar sin él'}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      <View style={styles.privacy}>
        <ShieldCheck size={19} color={colors.textMuted} />
        <Text style={styles.privacyText}>
          Solo durante tu viaje. Puedes dejar de compartir en cualquier momento; se detiene solo al
          bajar. Para seguir compartiendo con la pantalla apagada, elige «Permitir todo el tiempo»
          cuando te pidamos la ubicación.
        </Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  shareCard: {
    padding: 18,
    gap: 14,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  shareTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSize.title3,
    lineHeight: lineHeight(fontSize.title3, 1.3),
    color: colors.text,
  },
  shareBody: {
    fontFamily: fonts.regular,
    fontSize: fontSize.bodyLg,
    lineHeight: lineHeight(fontSize.bodyLg),
    color: colors.success,
  },
  qr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrLinked: { borderColor: colors.success, backgroundColor: colors.successSoft },
  qrText: { flex: 1, gap: 5 },
  qrTitle: { fontFamily: fonts.semibold, fontSize: fontSize.button, color: colors.text },
  qrSub: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 3 },
  privacyText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.textMuted,
  },
});
