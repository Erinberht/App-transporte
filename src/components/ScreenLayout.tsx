import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme';
import { Button } from './Button';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TOTAL_STEPS = 5;

type Props = {
  step: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  footerNote?: string;
  ctaLabel: string;
  ctaIcon?: IconName;
  onCta: () => void;
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
}: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <MaterialCommunityIcons name="bus" size={20} color={colors.primary} />
            <Text style={styles.brandText}>Mi bus</Text>
          </View>
          <Progress step={step} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      <View style={styles.footer}>
        {footerNote ? <Text style={styles.footerNote}>{footerNote}</Text> : null}
        <Button label={ctaLabel} icon={ctaIcon} onPress={onCta} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, backgroundColor: '#FBFCFE' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotDone: { backgroundColor: colors.primary },
  dotTodo: { backgroundColor: colors.border },
  dotActive: { width: 18 },
  progressText: { marginLeft: 6, color: colors.textMuted, fontSize: 11 },
  title: { marginTop: 14, fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { marginTop: 5, fontSize: 13, color: colors.textMuted },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 14 },
  footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, gap: 10 },
  footerNote: { fontSize: 12, color: colors.textMuted },
});
