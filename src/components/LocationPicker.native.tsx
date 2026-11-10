import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { MONTERIA_CENTER } from '../data/geo';
import { colors, fonts, fontSize, radius } from '../theme';
import type { LocationPickerProps } from './LocationPicker';

const ZOOM = { latitudeDelta: 0.01, longitudeDelta: 0.01 };
const CITY_ZOOM = { latitudeDelta: 0.08, longitudeDelta: 0.08 };

// Selector de ubicación sobre el mapa real: toca el mapa o arrastra el pin para marcar el lugar.
// No busca direcciones (eso enviaría el texto a un tercero, ver docs/PERFIL.md).
export function LocationPicker({ value, onChange, height }: LocationPickerProps) {
  const mapRef = useRef<MapView>(null);

  // Al usar la ubicación actual (o cambiar el valor desde fuera), centrar el mapa en el pin.
  useEffect(() => {
    if (value) mapRef.current?.animateToRegion({ ...value, ...ZOOM }, 300);
  }, [value]);

  return (
    <View style={[styles.map, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={value ? { ...value, ...ZOOM } : { ...MONTERIA_CENTER, ...CITY_ZOOM }}
        accessibilityLabel="Mapa para marcar el lugar"
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        userInterfaceStyle="light"
        onPress={(e) => onChange(e.nativeEvent.coordinate)}
      >
        {value ? (
          <Marker
            coordinate={value}
            draggable
            onDragEnd={(e) => onChange(e.nativeEvent.coordinate)}
            pinColor={colors.primary}
          />
        ) : null}
      </MapView>
      {!value ? (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>Toca el mapa para marcar el lugar</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.mapBase },
  hint: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
  },
  hintText: { fontFamily: fonts.semibold, fontSize: fontSize.small, color: colors.text },
});
