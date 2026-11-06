import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { getRoute } from '../data/routes';
import { useTrip } from '../state/trip';
import { colors, radius } from '../theme';

// Paso 3 de 5 · "Compartir recorrido"
export default function ShareTripScreen() {
  const { routeId, setSharing } = useTrip();
  const route = getRoute(routeId);

  return (
    <ScreenLayout
      step={3}
      title={`¿Subiste al bus ${route.name}?`}
      subtitle="Ayuda a quienes también esperan esta ruta."
      footerNote="Comparte tu recorrido, no tu identidad."
      ctaLabel="Compartir"
      ctaIcon="access-point"
      onCta={() => {
        // TODO: pedir permiso de ubicación (expo-location) y empezar a enviar posición anónima.
        setSharing(true);
        router.push('/en-viaje');
      }}
    >
      <RouteMap height={158} busLabel={route.name} />

      <View style={styles.shareCard}>
        <View style={styles.shareTop}>
          <View style={styles.shareIcon}>
            <MaterialCommunityIcons name="access-point" size={24} color={colors.success} />
          </View>
          <Text style={styles.shareTitle}>Compartir mi recorrido</Text>
        </View>
        <Text style={styles.shareBody}>
          Tu ubicación en vivo permite mostrar dónde va el bus {route.name}.
        </Text>
      </View>

      {/* TODO: abrir el escáner (expo-camera) y validar el QR del bus. */}
      <Pressable accessibilityRole="button" style={styles.qr}>
        <MaterialCommunityIcons name="qrcode-scan" size={32} color={colors.primary} />
        <View style={styles.qrText}>
          <Text style={styles.qrTitle}>Escanear el QR del bus</Text>
          <Text style={styles.qrSub}>Opcional · Puedes continuar sin él</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </Pressable>

      <View style={styles.privacy}>
        <MaterialCommunityIcons name="shield-check-outline" size={19} color={colors.textMuted} />
        <Text style={styles.privacyText}>
          Solo durante tu viaje. Puedes dejar de compartir en cualquier momento; se detiene solo al
          bajar.
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
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  shareBody: { fontSize: 14, color: colors.success, lineHeight: 20 },
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
  qrText: { flex: 1, gap: 3 },
  qrTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  qrSub: { fontSize: 12, color: colors.textMuted },
  privacy: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
