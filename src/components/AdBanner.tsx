import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, fontSize, radius } from '../theme';
import type { Ad } from '../types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  ad: Ad;
  /** "strip": franja compacta. "card": tarjeta con más texto. */
  variant?: 'strip' | 'card';
  onPress?: (ad: Ad) => void;
};

// Anuncio patrocinado. Siempre etiquetado como "Anuncio" para no confundirse con información del bus.
export function AdBanner({ ad, variant = 'strip', onPress }: Props) {
  const card = variant === 'card';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Anuncio: ${ad.brand}. ${ad.headline}`}
      onPress={() => onPress?.(ad)}
      style={[styles.root, { backgroundColor: ad.accentSoft }]}
    >
      <View style={[styles.icon, { backgroundColor: ad.accent }]}>
        <MaterialCommunityIcons name={ad.icon as IconName} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.text}>
        <View style={styles.meta}>
          <Text style={styles.tag}>Anuncio</Text>
          <Text style={[styles.brand, { color: ad.accent }]} numberOfLines={1}>
            {ad.brand}
          </Text>
        </View>
        <Text style={styles.headline} numberOfLines={1}>
          {ad.headline}
        </Text>
        {card ? (
          <Text style={styles.body} numberOfLines={2}>
            {ad.body}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.cta, { color: ad.accent }]}>{ad.cta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: {
    fontSize: fontSize.mapLabel,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  brand: { fontSize: fontSize.caption, fontFamily: fonts.semibold, flexShrink: 1 },
  headline: { fontSize: fontSize.bodyLg, fontFamily: fonts.semibold, color: colors.text },
  body: { fontSize: fontSize.small, fontFamily: fonts.regular, color: colors.textMuted },
  cta: { fontSize: fontSize.body, fontFamily: fonts.semibold },
});
