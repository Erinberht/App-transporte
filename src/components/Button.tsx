import { Check, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, fontSize, radius } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  /**
   * "primary": acción principal. "outline": acción secundaria.
   * "selected": opción elegida (alineada a la izquierda, con check al final).
   */
  variant?: 'primary' | 'outline' | 'selected';
};

export function Button({ label, onPress, icon: Icon, variant = 'primary' }: Props) {
  const selected = variant === 'selected';
  const textColor = variant === 'primary' ? colors.onPrimary : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={selected ? { selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        selected && styles.selected,
        pressed && { opacity: 0.85 },
      ]}
    >
      {Icon ? <Icon size={20} color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }, selected && styles.labelSelected]}>
        {label}
      </Text>
      {selected ? <Check size={18} color={textColor} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  outline: { backgroundColor: colors.surface, borderColor: colors.border },
  selected: {
    height: 54,
    gap: 10,
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  label: { fontFamily: fonts.semibold, fontSize: fontSize.button },
  labelSelected: { flex: 1 },
});
