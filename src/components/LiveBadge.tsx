import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

export function LiveBadge() {
  return (
    <View style={styles.root}>
      <View style={styles.dot} />
      <Text style={styles.text}>En vivo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.successSoft,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  text: { fontSize: 11, fontWeight: '600', color: colors.success },
});
