import { router } from 'expo-router';
import { ArrowRight, BusFront, Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '../components/AdBanner';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { SAMPLE_ADS } from '../data/ads';
import { ROUTES } from '../data/routes';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, radius } from '../theme';

// Paso 1 de 5 · "Elegir ruta"
export default function ChooseRouteScreen() {
  const { routeId, setRouteId } = useTrip();

  return (
    <ScreenLayout
      step={1}
      title="Elige tu ruta"
      subtitle="Encuentra tu bus y viaja con más certeza."
      footerNote="Selecciona una ruta para ver su recorrido."
      ctaLabel="Ver mi bus"
      ctaIcon={ArrowRight}
      onCta={() => router.push('/bus-en-el-mapa')}
    >
      <RouteMap height={164} />

      <View style={styles.list}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Rutas disponibles</Text>
          <Text style={styles.listCount}>{ROUTES.length} rutas</Text>
        </View>

        {ROUTES.map((route) => {
          const selected = route.id === routeId;
          return (
            <Pressable
              key={route.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setRouteId(route.id)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.badge, selected && styles.badgeSelected]}>
                <BusFront size={20} color={selected ? colors.onPrimary : colors.textMuted} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.routeName}>{route.name}</Text>
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 70,
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
  routeName: { fontFamily: fonts.semibold, fontSize: fontSize.lead, color: colors.text },
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
