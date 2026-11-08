import { BusFront, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, fontSize, lineHeight, radius } from '../theme';
import { Button } from './Button';

const TOTAL_STEPS = 5;

type Props = {
  step: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  footerNote?: string;
  ctaLabel: string;
  ctaIcon?: LucideIcon;
  onCta: () => void;
  /** Separación vertical entre bloques del contenido (varía por pantalla en el diseño). */
  gap?: number;
};

function Progress({ step }: { step: number }) {
  return (
    <View style={styles.progress} accessibilityLabel={`Paso ${step} de ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const n = i + 1;
        const active = n === step;
        return (
          <View
            key={n}
            style={[
              styles.dot,
              n <= step ? styles.dotDone : styles.dotTodo,
              active && styles.dotActive,
            ]}
          />
        );
      })}
      <Text style={styles.progressText}>
        {step} de {TOTAL_STEPS}
      </Text>
    </View>
  );
}

export function ScreenLayout({
  step,
  title,
  subtitle,
  children,
  footerNote,
  ctaLabel,
  ctaIcon,
  onCta,
  gap = 16,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      {/* El encabezado blanco se extiende bajo la barra de estado, como en el diseño. */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <BusFront size={20} color={colors.primary} />
            <Text style={styles.brandText}>Mi bus</Text>
          </View>
          <Progress step={step} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { gap }]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {footerNote ? <Text style={styles.footerNote}>{footerNote}</Text> : null}
        <Button label={ctaLabel} icon={ctaIcon} onPress={onCta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    gap: 11,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: colors.surface,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandText: { color: colors.primary, fontFamily: fonts.bold, fontSize: fontSize.brand },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: radius.pill },
  dotDone: { backgroundColor: colors.primary },
  dotTodo: { backgroundColor: colors.border },
  dotActive: { width: 18 },
  progressText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: fontSize.caption },
  titleBlock: { gap: 5 },
  title: { fontFamily: fonts.bold, fontSize: fontSize.title, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.body, color: colors.textMuted },
  scroll: { flex: 1 },
  content: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  footerNote: {
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight(fontSize.small),
    color: colors.textMuted,
  },
});
