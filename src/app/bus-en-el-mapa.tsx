import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LiveBadge } from '../components/LiveBadge';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { getRoute, ROUTES } from '../data/routes';
import { useTrip } from '../state/trip';
import { colors, radius } from '../theme';

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
      ctaIcon="check"
      onCta={() => router.push('/compartir')}
    >
      {notice ? (
        <View style={styles.notice}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.danger} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <RouteMap height={310} busLabel={route.name} />

      <View style={styles.arrival}>
        <View style={styles.arrivalTop}>
          <View style={styles.routeId}>
            <MaterialCommunityIcons name="bus" size={20} color={colors.text} />
            <Text style={styles.routeName}>{route.name}</Text>
          </View>
          <LiveBadge />
        </View>
        <View style={styles.arrivalBottom}>
          <Text style={styles.eta}>Llega en {route.etaMinutes} min</Text>
          <MaterialCommunityIcons name="clock-outline" size={24} color={colors.success} />
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendDots}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.legendDot} />
          ))}
        </View>
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
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  noticeText: { color: colors.danger, fontSize: 13 },
  arrival: {
    padding: 16,
    gap: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  arrivalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeId: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeName: { fontSize: 16, fontWeight: '800', color: colors.text },
  arrivalBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eta: { fontSize: 28, fontWeight: '800', color: colors.success },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDots: { flexDirection: 'row', gap: 3 },
  legendDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.route },
  legendText: { fontSize: 12, color: colors.textMuted },
});
