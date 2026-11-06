import { router } from 'expo-router';
import { ChevronRight, QrCode, Radio, ShieldCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { getRoute } from '../data/routes';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

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
      ctaIcon={Radio}
      onCta={() => {
        // TODO: pedir permiso de ubicación (expo-location) y empezar a enviar posición anónima.
        setSharing(true);
        router.push('/en-viaje');
      }}
      gap={18}
    >
      <RouteMap height={158} busLabel={route.name} />

      <View style={styles.shareCard}>
        <View style={styles.shareTop}>
          <View style={styles.shareIcon}>
            <Radio size={24} color={colors.success} />
          </View>
          <Text style={styles.shareTitle}>Compartir mi recorrido</Text>
        </View>
        <Text style={styles.shareBody}>
          Tu ubicación en vivo permite mostrar dónde va el bus {route.name}.
        </Text>
      </View>

      {/* TODO: abrir el escáner (expo-camera) y validar el QR del bus. */}
      <Pressable accessibilityRole="button" style={styles.qr}>
        <QrCode size={32} color={colors.primary} />
        <View style={styles.qrText}>
          <Text style={styles.qrTitle}>Escanear el QR del bus</Text>
          <Text style={styles.qrSub}>Opcional · Puedes continuar sin él</Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      <View style={styles.privacy}>
        <ShieldCheck size={19} color={colors.textMuted} />
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
