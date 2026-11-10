import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Check, LocateFixed } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LocationPicker } from '../components/LocationPicker';
import { PLACE_ICONS } from '../components/placeIcons';
import { ScreenLayout } from '../components/ScreenLayout';
import type { LatLng } from '../data/geo';
import { useUserLocation } from '../location/useUserLocation';
import { servedByAnyRoute } from '../planner/coverage';
import { cleanName, MAX_NAME_LENGTH, type PlaceIcon } from '../profile/model';
import { profileStore, useProfile } from '../profile/store';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

const ICON_OPTIONS: { icon: PlaceIcon; label: string }[] = [
  { icon: 'home', label: 'Casa' },
  { icon: 'work', label: 'Trabajo' },
  { icon: 'other', label: 'Otro' },
];

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/perfil'));

// Guardar o editar un lugar frecuente (casa, trabajo...). La ubicación se marca con la ubicación
// actual o tocando el mapa; se guarda solo en el teléfono.
export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useProfile().places.find((p) => p.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<PlaceIcon>(existing?.icon ?? 'home');
  const [picked, setPicked] = useState<LatLng | null>(existing?.coordinate ?? null);
  const [error, setError] = useState<string | null>(null);
  const location = useUserLocation();
  const [wantCurrent, setWantCurrent] = useState(false);

  // Solo se usa la ubicación actual si el usuario la pidió con el botón; tocar el mapa después
  // la reemplaza.
  const current = location.state.status === 'located' ? location.state.coords : null;
  const coordinate = (wantCurrent && current) || picked;

  const locationProblem =
    wantCurrent &&
    (location.state.status === 'denied' ||
      location.state.status === 'unavailable' ||
      location.state.status === 'error');

  const save = () => {
    const finalName = cleanName(name) || ICON_OPTIONS.find((o) => o.icon === icon)!.label;
    if (!coordinate) {
      setError('Marca el lugar en el mapa o usa tu ubicación actual.');
      return;
    }
    const saved = profileStore.savePlace({ id: existing?.id, name: finalName, icon, coordinate });
    if (!saved) {
      setError('No se pudo guardar: llegaste al máximo de lugares.');
      return;
    }
    goBack();
  };

  return (
    <ScreenLayout
      title={existing ? 'Editar lugar' : 'Guardar un lugar'}
      subtitle="Se guarda solo en este teléfono."
      ctaLabel="Guardar lugar"
      ctaIcon={Check}
      onCta={save}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo</Text>
        <View style={styles.chips}>
          {ICON_OPTIONS.map((option) => {
            const selected = option.icon === icon;
            const Icon = PLACE_ICONS[option.icon];
            return (
              <Pressable
                key={option.icon}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setIcon(option.icon)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Icon size={16} color={selected ? colors.onPrimary : colors.textMuted} />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nombre</Text>
        <TextInput
          accessibilityLabel="Nombre del lugar"
          placeholder={ICON_OPTIONS.find((o) => o.icon === icon)!.label}
          placeholderTextColor={colors.textMuted}
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChangeText={setName}
          style={styles.input}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ubicación</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setError(null);
            setWantCurrent(true);
            location.request();
          }}
          style={styles.locate}
        >
          {wantCurrent && location.state.status === 'locating' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <LocateFixed size={18} color={colors.primary} />
          )}
          <Text style={styles.link}>Usar mi ubicación actual</Text>
        </Pressable>
        {locationProblem ? (
          <Text style={styles.muted}>
            No pudimos leer tu ubicación. Marca el lugar tocando el mapa.
          </Text>
        ) : null}
        <LocationPicker
          height={240}
          value={coordinate}
          onChange={(value) => {
            setError(null);
            setWantCurrent(false);
            setPicked(value);
          }}
        />
        {coordinate && !servedByAnyRoute(coordinate) ? (
          <View style={styles.warning}>
            <AlertTriangle size={18} color={colors.warning} />
            <Text style={styles.warningText}>
              Ninguna de las rutas cargadas pasa cerca de este lugar. Puedes guardarlo igual, pero
              no podremos sugerirte cómo llegar.
            </Text>
          </View>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {existing ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            profileStore.removePlace(existing.id);
            goBack();
          }}
        >
          <Text style={[styles.link, { color: colors.danger }]}>Borrar este lugar</Text>
        </Pressable>
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.body, color: colors.text },
  chipTextSelected: { color: colors.onPrimary },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: fontSize.lead,
    color: colors.text,
  },
  locate: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  link: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.primary },
  muted: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
  warning: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
  },
  warningText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.warning,
  },
  error: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.danger },
});
