import { router } from 'expo-router';
import { BusFront, Check, Clock3, Info } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { LiveBadge } from '../components/LiveBadge';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { getRoute, ROUTES } from '../data/routes';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, radius } from '../theme';

// Paso 2 de 5 · "Bus en el mapa"
export default function BusOnMapScreen() {
  const { routeId } = useTrip();
  const route = getRoute(routeId);
  // Aviso de otra ruta (ej. "Rancho Grande: sin reportes"). Aquí irán retrasos, tráfico y desvíos.
  const notice = ROUTES.find((r) => r.notice && r.id !== route.id)?.notice;

  return (
    <ScreenLayout
      step={2}
      title="Tu bus en el mapa"
      subtitle={`Ruta ${route.name} · Sigue el recorrido hasta tu parada.`}
      footerNote="Cuando estés a bordo, confirma para continuar."
      ctaLabel="Ya subí"
      ctaIcon={Check}
      onCta={() => router.push('/compartir')}
      gap={14}
    >
      {notice ? (
        <View style={styles.notice}>
          <Info size={18} color={colors.danger} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <RouteMap height={310} busLabel={route.name} />

      <View style={styles.arrival}>
        <View style={styles.row}>
          <View style={styles.routeId}>
            <BusFront size={20} color={colors.text} />
            <Text style={styles.routeName}>{route.name}</Text>
          </View>
          <LiveBadge />
        </View>
        <View style={styles.row}>
          <Text style={styles.eta}>Llega en {route.etaMinutes} min</Text>
          <Clock3 size={24} color={colors.success} />
        </View>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendDots}>•••••</Text>
        <Text style={styles.legendText}>Recorrido de la ruta</Text>
      </View>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeId: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeName: { fontFamily: fonts.bold, fontSize: fontSize.heading, color: colors.text },
  eta: { fontFamily: fonts.bold, fontSize: fontSize.eta, color: colors.success },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDots: { fontFamily: fonts.regular, fontSize: fontSize.caption, color: colors.route },
  legendText: { fontFamily: fonts.regular, fontSize: fontSize.caption, color: colors.textMuted },
});
