import { router } from 'expo-router';
import { ArrowRight, Check, GraduationCap } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ClassTimeField } from '../components/ClassTimeField';
import { LocationCard } from '../components/LocationCard';
import { ScreenLayout } from '../components/ScreenLayout';
import { DESTINATIONS } from '../data/destinations';
import { useUserLocation } from '../location/useUserLocation';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, radius } from '../theme';

// Pantalla inicial · "¿A dónde vas?" (antes del flujo de 5 pasos).
export default function WhereToScreen() {
  const { destinationId, setDestinationId, classTime, setClassTime, setOrigin } = useTrip();
  const location = useUserLocation();

  // La ubicación detectada pasa a ser el origen del viaje (solo en memoria).
  const coords = location.state.status === 'located' ? location.state.coords : null;
  useEffect(() => {
    setOrigin(coords);
  }, [coords, setOrigin]);

  return (
    <ScreenLayout
      title="¿A dónde vas?"
      subtitle="Te ayudamos a llegar a tiempo a clase."
      footerNote="Puedes continuar sin compartir tu ubicación."
      ctaLabel="Buscar rutas"
      ctaIcon={ArrowRight}
      onCta={() => router.push('/elegir-ruta')}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Desde</Text>
        <LocationCard state={location.state} onRequest={location.request} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Destino</Text>
        {DESTINATIONS.map((destination) => {
          const selected = destination.id === destinationId;
          return (
            <Pressable
              key={destination.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setDestinationId(destination.id)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.badge, selected && styles.badgeSelected]}>
                <GraduationCap size={20} color={selected ? colors.onPrimary : colors.textMuted} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionName}>{destination.name}</Text>
                <Text style={styles.optionDetail}>{destination.detail}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <Check size={12} color={colors.onPrimary} strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hora de entrada a clase</Text>
        <ClassTimeField value={classTime} onChange={setClassTime} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.text },
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
  optionName: { fontFamily: fonts.semibold, fontSize: fontSize.lead, color: colors.text },
  optionDetail: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
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
