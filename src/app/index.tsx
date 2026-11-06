import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '../components/AdBanner';
import { RouteMap } from '../components/RouteMap';
import { ScreenLayout } from '../components/ScreenLayout';
import { SAMPLE_ADS } from '../data/ads';
import { ROUTES } from '../data/routes';
import { useTrip } from '../state/trip';
import { colors, radius } from '../theme';

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
      ctaIcon="arrow-right"
      onCta={() => router.push('/bus-en-el-mapa')}
    >
      <RouteMap height={164} />

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
              <MaterialCommunityIcons
                name="bus"
                size={20}
                color={selected ? '#FFFFFF' : colors.textMuted}
              />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.routeName}>{route.name}</Text>
              {selected ? <Text style={styles.selectedText}>Ruta seleccionada</Text> : null}
            </View>
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" /> : null}
            </View>
          </Pressable>
        );
      })}

      {/* Anuncio de muestra (modelo de negocio futuro) */}
      <AdBanner ad={SAMPLE_ADS[0]} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  listCount: { fontSize: 12, color: colors.textMuted },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 1.5 },
  badge: {
    width: 37,
    height: 37,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSelected: { backgroundColor: colors.primary },
  optionText: { flex: 1 },
  routeName: { fontSize: 16, fontWeight: '700', color: colors.text },
  selectedText: { fontSize: 11, color: colors.primary, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
