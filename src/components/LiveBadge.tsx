import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, fontSize, radius } from '../theme';

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
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  text: { fontFamily: fonts.semibold, fontSize: fontSize.caption, color: colors.success },
});
