import { router } from 'expo-router';
import { ArrowRight, BusFront, Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '../components/AdBanner';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { SAMPLE_ADS } from '../data/ads';
import { routesRepository } from '../data/repository';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, radius } from '../theme';

// Paso 1 de 5 · "Elegir ruta"
export default function ChooseRouteScreen() {
  const { routeId, origin, setRouteId } = useTrip();
  const routes = routesRepository.listRoutes();

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
      <RouteMap height={164} routeId={routeId} origin={origin} />

      <View style={styles.list}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Rutas disponibles</Text>
          <Text style={styles.listCount}>{routes.length} rutas</Text>
        </View>

        {routes.map((route) => {
          const selected = route.id === routeId;
          return (
            <Pressable
              key={route.id}
              accessibilityRole="radio"
              accessibilityLabel={`Ruta ${route.shortName}, ${route.longName}`}
              accessibilityState={{ selected }}
              onPress={() => setRouteId(route.id)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.badge, selected && styles.badgeSelected]}>
                <BusFront size={20} color={selected ? colors.onPrimary : colors.textMuted} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.routeName}>{route.shortName}</Text>
                <Text style={styles.longName} numberOfLines={1}>
                  {route.longName}
                </Text>
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
  longName: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
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
