import { MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { LatLng } from '../data/geo';
import { colors, fonts, fontSize, radius } from '../theme';

/** API del selector de ubicación (la comparten la versión con mapa y la de web). */
export type LocationPickerProps = {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  height: number;
};

// Web: react-native-maps no funciona, así que no se puede mover el pin. El lugar se guarda
// con "Usar mi ubicación actual". En iOS y Android, Metro usa LocationPicker.native.tsx.
export function LocationPicker({ value, height }: LocationPickerProps) {
  return (
    <View style={[styles.box, { height }]}>
      <MapPin size={22} color={value ? colors.primary : colors.textMuted} />
      <Text style={styles.text}>
        {value
          ? `Ubicación elegida (${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)})`
          : 'Usa tu ubicación actual para marcar el lugar.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.mapBase,
  },
  text: {
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
