import { router } from 'expo-router';
import { BellRing, Clock3, Search, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '../components/AdBanner';
import { Button } from '../components/Button';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { SAMPLE_ADS } from '../data/ads';
import { getRoute, OCCUPANCY_LABEL } from '../data/routes';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, radius } from '../theme';

// Paso 5 de 5 · "Alerta de llegada"
export default function ArrivalAlertScreen() {
  const { routeId, occupancy, reset } = useTrip();
  const route = getRoute(routeId);
  const [choice, setChoice] = useState<'wait' | 'search'>('wait');

  return (
    <ScreenLayout
      step={5}
      title="Tu bus está cerca"
      subtitle={`Consulta la llegada y el cupo de la ruta ${route.name}.`}
      footerNote="Fin del recorrido. Gracias por compartir."
      ctaLabel="Fin"
      onCta={() => {
        reset();
        router.replace('/');
      }}
    >
      <View style={styles.alert}>
        <View style={styles.alertTop}>
          <BellRing size={20} color={colors.success} />
          <Text style={styles.alertType}>Alerta de llegada · {route.name}</Text>
        </View>
        <Text style={styles.alertMessage}>Tu bus llega en {route.etaMinutes} min</Text>
      </View>

      <RouteMap height={192} busLabel={route.name} />

      <View style={styles.occupancy}>
        <Users size={24} color={colors.primary} />
        <View style={styles.occupancyText}>
          <Text style={styles.occupancyTitle}>
            Cupo: {OCCUPANCY_LABEL[occupancy].toLowerCase()}
          </Text>
          <Text style={styles.occupancySub}>Reportado por un viajero</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Esperar"
          icon={Clock3}
          variant={choice === 'wait' ? 'selected' : 'outline'}
          onPress={() => setChoice('wait')}
        />
        <Button
          label="Buscar otra ruta"
          icon={Search}
          variant={choice === 'search' ? 'selected' : 'outline'}
          onPress={() => {
            setChoice('search');
            router.replace('/');
          }}
        />
      </View>

      {/* Anuncio de muestra: aparece al final del recorrido, cuando el usuario ya terminó. */}
      <AdBanner ad={SAMPLE_ADS[2]} variant="card" />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  alert: {
    padding: 18,
    gap: 10,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  alertTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertType: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.success },
  alertMessage: { fontFamily: fonts.bold, fontSize: fontSize.alert, color: colors.success },
  occupancy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  occupancyText: { flex: 1, gap: 4 },
  occupancyTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lead, color: colors.text },
  occupancySub: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
  actions: { gap: 10 },
});
