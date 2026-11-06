import { LocateFixed, MapPinOff, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { UserLocationState } from '../location/useUserLocation';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

type Props = {
  state: UserLocationState;
  onRequest: () => void;
};

function copy(state: UserLocationState): { title: string; body: string; action?: string } {
  switch (state.status) {
    case 'idle':
      return {
        title: 'Usar mi ubicación actual',
        body: 'Para sugerirte la parada y la ruta más cercanas.',
        action: 'Permitir ubicación',
      };
    case 'locating':
      return { title: 'Buscando tu ubicación…', body: 'Esto toma unos segundos.' };
    case 'located':
      return {
        title: 'Ubicación actual detectada',
        body:
          state.accuracy != null
            ? `Precisión aproximada: ${Math.round(state.accuracy)} m.`
            : 'Usaremos este punto como inicio del viaje.',
      };
    case 'denied':
      return state.canAskAgain
        ? {
            title: 'Sin permiso de ubicación',
            body: 'Puedes continuar y elegir tu ruta manualmente.',
            action: 'Intentar de nuevo',
          }
        : {
            title: 'Ubicación desactivada para Mi bus',
            body: 'Puedes activarla en los ajustes del teléfono o continuar sin ella.',
            action: 'Abrir ajustes',
          };
    case 'unavailable':
      return {
        title: 'La ubicación del teléfono está apagada',
        body: 'Activa el GPS o continúa sin tu ubicación.',
        action: 'Intentar de nuevo',
      };
    case 'error':
      return {
        title: 'No pudimos obtener tu ubicación',
        body: 'Revisa tu señal o continúa sin ella.',
        action: 'Intentar de nuevo',
      };
  }
}

// Tarjeta "Desde": explica para qué se usa la ubicación ANTES de pedir el permiso
// (consentimiento informado, Ley 1581 de 2012) y muestra el resultado.
export function LocationCard({ state, onRequest }: Props) {
  const { title, body, action } = copy(state);
  const located = state.status === 'located';
  const problem =
    state.status === 'denied' || state.status === 'unavailable' || state.status === 'error';
  const openSettings = state.status === 'denied' && !state.canAskAgain;

  return (
    <View style={[styles.card, located && styles.cardLocated]}>
      <View style={styles.row}>
        <View style={[styles.icon, located && styles.iconLocated]}>
          {state.status === 'locating' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : problem ? (
            <MapPinOff size={20} color={colors.textMuted} />
          ) : (
            <LocateFixed size={20} color={located ? colors.success : colors.primary} />
          )}
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, located && { color: colors.success }]}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>

      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={openSettings ? () => Linking.openSettings() : onRequest}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      ) : null}

      <View style={styles.privacy}>
        <ShieldCheck size={14} color={colors.textMuted} />
        <Text style={styles.privacyText}>
          Tu ubicación se queda en tu teléfono y no se comparte.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLocated: { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLocated: { backgroundColor: colors.surface },
  text: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.lead, color: colors.text },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.textMuted,
  },
  action: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontFamily: fonts.semibold, fontSize: fontSize.bodyLg, color: colors.primary },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privacyText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
