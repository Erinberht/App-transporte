import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

type Props = {
  height: number;
  /** Etiqueta de la ruta cuyo bus se dibuja en el mapa (ej. "T2"). Sin valor, no se muestra bus. */
  busLabel?: string;
};

// Mapa ilustrativo hecho con Views, igual al del prototipo. Reemplazar por un mapa real
// (react-native-maps / MapLibre) cuando se conecte el GPS de las busetas.
function Dotted({
  direction,
  left,
  top,
  size,
}: {
  direction: 'h' | 'v';
  left: `${number}%`;
  top: `${number}%`;
  size: `${number}%`;
}) {
  const horizontal = direction === 'h';
  const count = horizontal ? 14 : 7;
  return (
    <View
      style={[
        styles.dotted,
        horizontal
          ? { left, top, width: size, flexDirection: 'row' }
          : { left, top, height: size, flexDirection: 'column' },
      ]}
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.routeDot} />
      ))}
    </View>
  );
}

function pct(n: number): `${number}%` {
  return `${n}%`;
}

export function RouteMap({ height, busLabel }: Props) {
  return (
    <View style={[styles.map, { height }]}>
      <View style={styles.river} />
      <View style={[styles.block, styles.park]} />
      <Text style={[styles.label, { left: '5%', top: '44%' }]}>Parque</Text>

      {[
        { left: 31, top: 7, width: 26, height: 16 },
        { left: 31, top: 34, width: 26, height: 19 },
        { left: 69, top: 34, width: 15, height: 19 },
        { left: 31, top: 71, width: 26, height: 18 },
      ].map((b, i) => (
        <View
          key={i}
          style={[
            styles.block,
            { left: pct(b.left), top: pct(b.top), width: pct(b.width), height: pct(b.height) },
          ]}
        />
      ))}

      {[23, 61.6, 87].map((x) => (
        <View key={x} style={[styles.street, { left: pct(x), width: 14, top: 0, bottom: 0 }]} />
      ))}
      {[22, 56, 90].map((y) => (
        <View key={y} style={[styles.street, { top: pct(y), height: 16, left: 0, right: 0 }]} />
      ))}
      <Text style={[styles.label, { left: '33%', top: '14%' }]}>Av. Principal</Text>

      {/* Recorrido punteado: parada del usuario -> destino */}
      <Dotted direction="v" left="24.8%" top="60%" size="24%" />
      <Dotted direction="h" left="24.8%" top="59.5%" size="39%" />
      <Dotted direction="v" left="63.2%" top="26%" size="34%" />
      <Dotted direction="h" left="63.2%" top="25.5%" size="26%" />
      <View style={[styles.stop, { left: '88%', top: '22%' }]} />

      {busLabel ? (
        <View style={[styles.bus, { left: '56%', top: '34%' }]}>
          <MaterialCommunityIcons name="bus" size={16} color="#FFFFFF" />
          <Text style={styles.busText}>{busLabel}</Text>
        </View>
      ) : null}

      <View style={[styles.userHalo, { left: '25%', top: '84%' }]} />
      <View style={[styles.userDot, { left: '25%', top: '84%' }]} />
      <View style={[styles.stopLabel, { left: '31%', top: '81%' }]}>
        <Text style={styles.stopLabelText}>Tu parada</Text>
      </View>

      <View style={styles.locate}>
        <MaterialCommunityIcons name="crosshairs-gps" size={18} color={colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.mapBase },
  river: {
    position: 'absolute',
    right: -34,
    top: -30,
    width: 90,
    bottom: -30,
    backgroundColor: colors.mapRiver,
    borderRadius: 40,
    transform: [{ rotate: '6deg' }],
  },
  block: { position: 'absolute', backgroundColor: colors.mapBlock, borderRadius: 6 },
  park: { left: '4%', top: '34%', width: '17%', height: '23%', backgroundColor: colors.mapPark },
  street: { position: 'absolute', backgroundColor: colors.mapStreet },
  label: { position: 'absolute', fontSize: 9, color: colors.textMuted },
  dotted: { position: 'absolute', justifyContent: 'space-between', overflow: 'hidden' },
  routeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.route },
  stop: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.route,
  },
  bus: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.success,
  },
  busText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  userHalo: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: -18,
    marginTop: -18,
    backgroundColor: 'rgba(35, 96, 217, 0.15)',
  },
  userDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    marginTop: -7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stopLabel: {
    position: 'absolute',
    marginTop: -11,
    paddingHorizontal: 8,
    height: 22,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  stopLabelText: { fontSize: 10, fontWeight: '600', color: colors.text },
  locate: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
