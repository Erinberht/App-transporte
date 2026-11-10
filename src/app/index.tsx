import { router } from 'expo-router';
import { ArrowRight, CalendarClock, Check, Plus, UserRound } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ClassTimeField } from '../components/ClassTimeField';
import { LocationCard } from '../components/LocationCard';
import { PLACE_ICONS } from '../components/placeIcons';
import { ScreenLayout } from '../components/ScreenLayout';
import { allDestinations, DEFAULT_DESTINATION_ID } from '../data/destinations';
import { formatClassTime } from '../lib/classTime';
import { useNow } from '../lib/useNow';
import { useUserLocation } from '../location/useUserLocation';
import { MAX_PLACES, nextClass } from '../profile/model';
import { useProfile } from '../profile/store';
import { useTrip } from '../state/trip';
import { colors, fonts, fontSize, lineHeight, radius } from '../theme';

// Pantalla inicial · "¿A dónde vas?".
export default function WhereToScreen() {
  const {
    destination,
    setDestinationId,
    classTime,
    setClassTime,
    setOrigin,
    proposedClassKey,
    setProposedClassKey,
  } = useTrip();
  const { classes, places } = useProfile();
  const location = useUserLocation();
  const now = useNow(60_000);

  // La ubicación detectada pasa a ser el origen del viaje (solo en memoria).
  const coords = location.state.status === 'located' ? location.state.coords : null;
  useEffect(() => {
    setOrigin(coords);
  }, [coords, setOrigin]);

  // Propone la próxima clase de hoy (destino universidad y su hora) una sola vez: si el usuario
  // cambia el destino o la hora a mano, no se le vuelve a imponer.
  const next = nextClass(classes, new Date(now));
  const nextKey = next
    ? `${next.id}@${next.start.hours}:${next.start.minutes}:${new Date(now).toDateString()}`
    : null;
  useEffect(() => {
    if (!next || !nextKey || nextKey === proposedClassKey) return;
    setProposedClassKey(nextKey);
    setDestinationId(DEFAULT_DESTINATION_ID);
    setClassTime(next.start);
  }, [next, nextKey, proposedClassKey, setProposedClassKey, setDestinationId, setClassTime]);

  const isCampus = destination.kind === 'campus';
  const followingNext =
    next !== null &&
    isCampus &&
    classTime.hours === next.start.hours &&
    classTime.minutes === next.start.minutes;

  return (
    <ScreenLayout
      title="¿A dónde vas?"
      subtitle="Te ayudamos a llegar a tiempo a clase."
      footerNote="Puedes continuar sin compartir tu ubicación."
      ctaLabel="Buscar rutas"
      ctaIcon={ArrowRight}
      onCta={() => router.push('/elegir-ruta')}
      headerAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mi perfil: horario, lugares y caminata"
          onPress={() => router.push('/perfil')}
          style={styles.profileButton}
        >
          <UserRound size={18} color={colors.primary} />
          <Text style={styles.profileText}>Mi perfil</Text>
        </Pressable>
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Desde</Text>
        <LocationCard state={location.state} onRequest={location.request} />
      </View>

      {next ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Próxima clase: ${next.name || 'clase'} a las ${formatClassTime(next.start)}`}
          disabled={followingNext}
          onPress={() => {
            setDestinationId(DEFAULT_DESTINATION_ID);
            setClassTime(next.start);
          }}
          style={styles.nextClass}
        >
          <CalendarClock size={20} color={colors.primary} />
          <View style={styles.optionText}>
            <Text style={styles.nextTitle}>
              Próxima clase hoy{next.name ? `: ${next.name}` : ''}
            </Text>
            <Text style={styles.nextDetail}>
              {formatClassTime(next.start)} · Universidad de Córdoba
            </Text>
          </View>
          {followingNext ? null : <Text style={styles.link}>Usar</Text>}
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Destino</Text>
        {allDestinations(places).map((option) => {
          const selected = option.id === destination.id;
          const Icon = PLACE_ICONS[option.icon];
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setDestinationId(option.id)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.badge, selected && styles.badgeSelected]}>
                <Icon size={20} color={selected ? colors.onPrimary : colors.textMuted} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionName}>{option.name}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <Check size={12} color={colors.onPrimary} strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
        {places.length < MAX_PLACES ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/lugar')}
            style={styles.addPlace}
          >
            <Plus size={18} color={colors.primary} />
            <Text style={styles.link}>Guardar un lugar (casa, trabajo…)</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isCampus
            ? 'Hora de entrada a clase'
            : `¿A qué hora quieres llegar a ${destination.name}?`}
        </Text>
        <ClassTimeField
          value={classTime}
          onChange={setClassTime}
          caption={isCampus ? 'Entrada a clase' : 'Llegada'}
        />
        {classes.length === 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/perfil')}>
            <Text style={styles.hint}>
              Guarda tu horario en <Text style={styles.link}>Mi perfil</Text> y te proponemos la
              hora de tu próxima clase.
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.text },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  profileText: { fontFamily: fonts.semibold, fontSize: fontSize.small, color: colors.primary },
  nextClass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  nextTitle: { fontFamily: fonts.semibold, fontSize: fontSize.bodyLg, color: colors.text },
  nextDetail: { fontFamily: fonts.regular, fontSize: fontSize.small, color: colors.textMuted },
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
  addPlace: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  link: { fontFamily: fonts.semibold, fontSize: fontSize.body, color: colors.primary },
  hint: {
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.textMuted,
  },
});
