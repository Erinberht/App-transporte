import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius } from '../theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'outline' | 'selected';
};

export function Button({ label, onPress, icon, variant = 'primary' }: Props) {
  const textColor = variant === 'primary' ? '#FFFFFF' : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'selected' && styles.selected,
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selected: { backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.primary },
  label: { fontSize: 16, fontWeight: '700' },
});
