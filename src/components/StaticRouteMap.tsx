import { BusFront, LocateFixed, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts, fontSize, radius } from '../theme';

/** API pública del mapa (la comparten el mapa real y el de respaldo). */
export type RouteMapProps = {
  height: number;
  /** Etiqueta de la ruta cuyo bus se dibuja en el mapa (ej. "T2"). Sin valor, no se muestra bus. */
  busLabel?: string;
};

// Mapa ilustrativo hecho con Views, igual al del prototipo de Figma ("Mapa de la ruta").
// Se usa como respaldo cuando no hay conexión (o en web), ver RouteMap.
// Las medidas salen del diseño: ancho de referencia 362 px y posiciones verticales
// proporcionales a la altura del mapa (que cambia en cada pantalla).
const DESIGN_WIDTH = 362;
/** Centros verticales de las tres avenidas, como fracción de la altura. */
const AVENUES = [0.26, 0.6, 0.94];
/** Centros horizontales de las tres calles (px en el diseño). */
const STREETS = [90, 230, 322];
const BLOCKS = [
  { x: 111, w: 96, top: null, h: 0.16 },
  { x: 111, w: 96, top: 0.34, h: 0.19 },
  { x: 251, w: 55, top: 0.34, h: 0.19 },
  { x: 111, w: 96, top: 0.71, h: 0.18 },
] as const;
const USER = { x: 90, y: 0.85 };
const BUS = { x: 203, y: 0.43 };

function pctX(x: number): DimensionValue {
  return `${(x / DESIGN_WIDTH) * 100}%`;
}

/** Polilínea con esquinas redondeadas (radio r). */
function roundedPath(points: [number, number][], r = 8): string {
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, inLen / 2, outLen / 2);
    const ax = cx - ((cx - px) / inLen) * rr;
    const ay = cy - ((cy - py) / inLen) * rr;
    const bx = cx + ((nx - cx) / outLen) * rr;
    const by = cy + ((ny - cy) / outLen) * rr;
    d += ` L${ax},${ay} Q${cx},${cy} ${bx},${by}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L${lx},${ly}`;
}

type Props = RouteMapProps & {
  /** Muestra un aviso de que el mapa real no está disponible por falta de conexión. */
  offline?: boolean;
};

export function StaticRouteMap({ height, busLabel, offline = false }: Props) {
  const [width, setWidth] = useState(DESIGN_WIDTH);
  const sx = width / DESIGN_WIDTH;
  const y = (f: number) => f * height;

  // Recorrido: parada del usuario -> avenida central -> segunda calle -> avenida superior -> destino.
  const route = roundedPath([
    [USER.x * sx, y(USER.y)],
    [USER.x * sx, y(AVENUES[1])],
    [STREETS[1] * sx, y(AVENUES[1])],
    [STREETS[1] * sx, y(AVENUES[0])],
    [STREETS[2] * sx, y(AVENUES[0])],
  ]);

  return (
    <View
      style={[styles.map, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel="Mapa del recorrido de la ruta"
    >
      <View style={[styles.river, { height: height + 50, right: 0.104 * height - 32 }]} />

      <View
        style={[styles.park, { left: pctX(15), width: pctX(61), top: y(0.34), height: y(0.23) }]}
      >
        {height >= 180 ? <Text style={styles.parkLabel}>Parque</Text> : null}
      </View>

      {BLOCKS.map((b, i) => (
        <View
          key={i}
          style={[
            styles.block,
            {
              left: pctX(b.x),
              width: pctX(b.w),
              top: b.top === null ? 13 : y(b.top),
              height: y(b.h),
            },
          ]}
        />
      ))}

      {STREETS.map((x) => (
        <View
          key={x}
          style={[styles.street, { left: pctX(x - 7), width: 14, top: 0, bottom: 0 }]}
        />
      ))}
      {AVENUES.map((f) => (
        <View key={f} style={[styles.street, { top: y(f) - 8, height: 16, left: 0, right: 0 }]} />
      ))}
      <Text style={[styles.label, { left: pctX(122), top: y(AVENUES[0]) - 20 }]}>
        Av. Principal
      </Text>

      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={route}
          stroke={colors.route}
          strokeWidth={3}
          strokeDasharray="0.1 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <View style={[styles.stop, { left: STREETS[2] * sx - 5, top: y(AVENUES[0]) - 5 }]} />

      {busLabel ? (
        <View style={[styles.bus, { left: pctX(BUS.x), top: y(BUS.y) - 17 }]}>
          <BusFront size={16} color={colors.onPrimary} />
          <Text style={styles.busText}>{busLabel}</Text>
        </View>
      ) : null}

      <View style={[styles.userHalo, { left: USER.x * sx - 18, top: y(USER.y) - 18 }]} />
      <View style={[styles.userDot, { left: USER.x * sx - 7, top: y(USER.y) - 7 }]} />
      <View style={[styles.stopLabel, { left: pctX(108), top: y(USER.y) - 11 }]}>
        <Text style={styles.stopLabelText}>Tu parada</Text>
      </View>

      {offline ? (
        <View style={styles.offline} accessibilityRole="alert">
          <WifiOff size={12} color={colors.textMuted} />
          <Text style={styles.offlineText}>Sin conexión · mapa ilustrativo</Text>
        </View>
      ) : null}

      <View style={styles.locate}>
        <LocateFixed size={18} color={colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.mapBase },
  river: {
    position: 'absolute',
    top: -25,
    width: 55,
    backgroundColor: colors.mapRiver,
    transform: [{ rotate: '12deg' }],
  },
  block: { position: 'absolute', backgroundColor: colors.mapBlock, borderRadius: radius.xs },
  park: {
    position: 'absolute',
    borderRadius: radius.sm,
    backgroundColor: colors.mapPark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkLabel: { fontFamily: fonts.regular, fontSize: fontSize.mapLabel, color: colors.success },
  street: { position: 'absolute', backgroundColor: colors.mapStreet },
  label: {
    position: 'absolute',
    fontFamily: fonts.regular,
    fontSize: fontSize.mapLabel,
    color: colors.textMuted,
  },
  stop: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.route,
  },
  bus: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.success,
  },
  busText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: fontSize.small },
  userHalo: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(35, 94, 215, 0.15)',
  },
  userDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  stopLabel: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
  },
  stopLabelText: { fontFamily: fonts.semibold, fontSize: fontSize.tiny, color: colors.text },
  offline: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  offlineText: { fontFamily: fonts.medium, fontSize: fontSize.tiny, color: colors.textMuted },
  locate: {
    position: 'absolute',
    right: 12,
    bottom: 13,
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
