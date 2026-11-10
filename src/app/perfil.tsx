import { router } from 'expo-router';
import { Pencil, Plus, ShieldCheck, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { ClassTimeField } from '../components/ClassTimeField';
import { PLACE_ICONS } from '../components/placeIcons';
import { ScreenLayout } from '../components/ScreenLayout';
import { placeToDestination } from '../data/destinations';
import type { ClassTime } from '../lib/classTime';
import { MAX_WALK_LIMIT, MIN_WALK_LIMIT, type WalkingPrefs } from '../planner/recommend';
import {
  classesOn,
  MAX_CLASSES_PER_DAY,
  MAX_NAME_LENGTH,
  MAX_PLACES,
  WEEKDAY_NAME,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type Weekday,
} from '../profile/model';
import { profileStore, useProfile } from '../profile/store';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

const WALK_LIMITS: (number | null)[] = [null];
for (let m = MIN_WALK_LIMIT; m <= MAX_WALK_LIMIT; m += 2) WALK_LIMITS.push(m);

/** Hora sugerida para una clase nueva: 2 h después de la última del día, o 7:00 a. m. */
function suggestedStart(last: ClassTime | undefined): ClassTime {
  if (!last) return { hours: 7, minutes: 0 };
  return { hours: Math.min(last.hours + 2, 22), minutes: last.minutes };
}

// "Mi perfil" (etapa 4.1): horario de clases, lugares frecuentes y opciones de caminata.
// Es opcional y vive solo en el teléfono (src/profile, docs/PERFIL.md).
export default function ProfileScreen() {
  const profile = useProfile();
  const [day, setDay] = useState<Weekday>(() => new Date().getDay() as Weekday);
  const [confirmClear, setConfirmClear] = useState(false);
  const dayClasses = classesOn(profile.classes, day);

  return (
    <ScreenLayout
      title="Mi perfil"
      subtitle="Opcional. Se guarda solo en este teléfono."
      ctaLabel="Listo"
      onCta={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      gap={24}
    >
      {/* Horario */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Horario de clases</Text>
        <View style={styles.chips} accessibilityRole="tablist">
          {WEEKDAYS.map((d) => {
            const selected = d === day;
            const count = classesOn(profile.classes, d).length;
            return (
              <Pressable
                key={d}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${WEEKDAY_NAME[d]}: ${count} ${count === 1 ? 'clase' : 'clases'}`}
                onPress={() => setDay(d)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {WEEKDAY_SHORT[d]}
                </Text>
                {count > 0 ? <View style={[styles.dot, selected && styles.dotSelected]} /> : null}
              </Pressable>
            );
          })}
        </View>

        {dayClasses.length === 0 ? (
          <Text style={styles.muted}>Sin clases el {WEEKDAY_NAME[day]}.</Text>
        ) : null}

        {dayClasses.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <ClassTimeField
              value={entry.start}
              onChange={(start) => profileStore.updateClass(entry.id, { start })}
            />
            <View style={styles.classRow}>
              <TextInput
                accessibilityLabel="Nombre de la clase"
                placeholder="Nombre (opcional), ej. Cálculo"
                placeholderTextColor={colors.textMuted}
                defaultValue={entry.name}
                maxLength={MAX_NAME_LENGTH}
                onChangeText={(name) => profileStore.updateClass(entry.id, { name })}
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar la clase de las ${entry.start.hours}:${String(entry.start.minutes).padStart(2, '0')}`}
                onPress={() => profileStore.removeClass(entry.id)}
                style={styles.iconButton}
              >
                <Trash size={18} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        ))}

        {dayClasses.length < MAX_CLASSES_PER_DAY ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => profileStore.addClass(day, suggestedStart(dayClasses.at(-1)?.start))}
            style={styles.addRow}
          >
            <Plus size={18} color={colors.primary} />
            <Text style={styles.link}>Agregar clase el {WEEKDAY_NAME[day]}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Lugares */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mis lugares</Text>
        <Text style={styles.muted}>
          Aparecen como destino en “¿A dónde vas?”. Solo te sugerimos las rutas cargadas en la app:
          si ninguna llega cerca, te avisamos.
        </Text>
        {profile.places.map((place) => {
          const destination = placeToDestination(place);
          const Icon = PLACE_ICONS[destination.icon];
          return (
            <View key={place.id} style={[styles.card, styles.placeRow]}>
              <View style={styles.badge}>
                <Icon size={18} color={colors.textMuted} />
              </View>
              <View style={styles.placeText}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.muted}>{destination.detail}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Editar ${place.name}`}
                onPress={() => router.push({ pathname: '/lugar', params: { id: place.id } })}
                style={styles.iconButton}
              >
                <Pencil size={18} color={colors.primary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Borrar ${place.name}`}
                onPress={() => profileStore.removePlace(place.id)}
                style={styles.iconButton}
              >
                <Trash size={18} color={colors.danger} />
              </Pressable>
            </View>
          );
        })}
        {profile.places.length < MAX_PLACES ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/lugar')}
            style={styles.addRow}
          >
            <Plus size={18} color={colors.primary} />
            <Text style={styles.link}>Guardar un lugar</Text>
          </Pressable>
        ) : (
          <Text style={styles.muted}>Llegaste al máximo de {MAX_PLACES} lugares.</Text>
        )}
      </View>

      {/* Caminata (como en Moovit) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Caminata</Text>
        <Text style={styles.label}>Ritmo</Text>
        <View style={styles.chips}>
          {(
            [
              ['normal', 'Normal'],
              ['slow', 'Lento'],
            ] as const
          ).map(([pace, label]) => (
            <Choice
              key={pace}
              label={label}
              selected={profile.walking.pace === pace}
              onPress={() => profileStore.setWalking({ ...profile.walking, pace })}
            />
          ))}
        </View>
        <Text style={styles.label}>Máximo a pie por tramo</Text>
        <View style={styles.chips}>
          {WALK_LIMITS.map((limit) => (
            <Choice
              key={String(limit)}
              label={limit === null ? 'Sin límite' : `${limit} min`}
              selected={profile.walking.maxWalkMinutes === limit}
              onPress={() =>
                profileStore.setWalking({
                  ...profile.walking,
                  maxWalkMinutes: limit,
                } satisfies WalkingPrefs)
              }
            />
          ))}
        </View>
      </View>

      {/* Privacidad y borrado */}
      <View style={styles.section}>
        <View style={styles.privacy}>
          <ShieldCheck size={18} color={colors.success} />
          <Text style={styles.privacyText}>
            Tu horario y tus lugares se quedan en este teléfono: no se envían a ningún servidor.
          </Text>
        </View>
        {confirmClear ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>
              ¿Borrar tu horario, tus lugares y tus opciones de caminata? No se puede deshacer.
            </Text>
            <Button
              label="Sí, borrar mi perfil"
              onPress={() => {
                profileStore.clear();
                setConfirmClear(false);
              }}
            />
            <Button label="Cancelar" variant="outline" onPress={() => setConfirmClear(false)} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmClear(true)}
            style={styles.addRow}
          >
            <Trash size={18} color={colors.danger} />
            <Text style={[styles.link, { color: colors.danger }]}>Borrar mi perfil</Text>
          </Pressable>
        )}
      </View>
    </ScreenLayout>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lead, color: colors.text },
  label: { fontFamily: fonts.medium, fontSize: fontSize.body, color: colors.text },
  muted: {
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.textMuted,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  dotSelected: { backgroundColor: colors.onPrimary },
  card: {
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    fontFamily: fonts.regular,
    fontSize: fontSize.bodyLg,
    color: colors.text,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  link: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.primary },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: { flex: 1, gap: 2 },
  placeName: { fontFamily: fonts.semibold, fontSize: fontSize.bodyLg, color: colors.text },
  privacy: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.successSoft,
  },
  privacyText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.success,
  },
  confirm: {
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  confirmText: {
    fontFamily: fonts.medium,
    fontSize: fontSize.body,
    lineHeight: lineHeight(fontSize.body),
    color: colors.danger,
  },
});
