import { useNetworkState } from 'expo-network';
import { BusFront, LocateFixed } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { tripMapData } from '../data/tripMap';
import { colors, fonts, fontSize, radius } from '../theme';
import { StaticRouteMap, type RouteMapProps } from './StaticRouteMap';

const USER_ZOOM = { latitudeDelta: 0.008, longitudeDelta: 0.008 };
/** Ancho fijo del marcador "Tu parada" para poder anclarlo al centro del punto azul. */
const USER_MARKER_WIDTH = 120;

// Mapa real de Montería (react-native-maps: Apple Maps en iOS, Google Maps en Android).
// Sin conexión se muestra el mapa ilustrativo, que no necesita descargar teselas.
export function RouteMap({
  height,
  busLabel,
  routeId,
  origin,
  boardStopId,
  liveBuses,
}: RouteMapProps) {
  const network = useNetworkState();
  // Mientras el estado de red no se conoce (undefined) se asume que hay conexión.
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const mapRef = useRef<MapView>(null);
  const data = useMemo(
    () => tripMapData(routeId, origin, undefined, boardStopId),
    [routeId, origin, boardStopId],
  );

  if (offline) return <StaticRouteMap height={height} busLabel={busLabel} offline />;

  return (
    <View style={[styles.map, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // key: al cambiar de ruta se vuelve a encuadrar el recorrido.
        key={routeId}
        initialRegion={data.region}
        accessibilityLabel="Mapa del recorrido de la ruta en Montería"
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        showsCompass={false}
        // La app es de tema claro (app.json: userInterfaceStyle "light"); el mapa no sigue el modo oscuro del sistema.
        userInterfaceStyle="light"
      >
        <Polyline
          coordinates={data.path}
          strokeColor={colors.route}
          strokeWidth={4}
          lineDashPattern={[1, 10]}
          lineCap="round"
          lineJoin="round"
        />

        <Marker coordinate={data.destinationStop} anchor={{ x: 0.5, y: 0.5 }} title="Universidad">
          <View style={styles.stop} />
        </Marker>

        <Marker coordinate={data.userStop} anchor={{ x: 18 / USER_MARKER_WIDTH, y: 0.5 }}>
          <View style={styles.userMarker}>
            <View style={styles.userHalo}>
              <View style={styles.userDot} />
            </View>
            <View style={styles.stopLabel}>
              <Text style={styles.stopLabelText}>Tu parada</Text>
            </View>
          </View>
        </Marker>

        {busLabel
          ? (liveBuses?.length ? liveBuses : [data.busPosition]).map((position, i) => (
              <Marker
                key={i}
                coordinate={position}
                anchor={{ x: 0.5, y: 0.5 }}
                title={liveBuses?.length ? `Bus ${busLabel} en vivo` : undefined}
              >
                <View style={styles.bus}>
                  <BusFront size={16} color={colors.onPrimary} />
                  <Text style={styles.busText}>{busLabel}</Text>
                </View>
              </Marker>
            ))
          : null}
      </MapView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Centrar en tu parada"
        onPress={() => mapRef.current?.animateToRegion({ ...data.userStop, ...USER_ZOOM }, 400)}
        style={styles.locate}
      >
        <LocateFixed size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.mapBase },
  stop: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.route,
  },
  userMarker: {
    width: USER_MARKER_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userHalo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(35, 94, 215, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  stopLabel: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
  },
  stopLabelText: { fontFamily: fonts.semibold, fontSize: fontSize.tiny, color: colors.text },
  bus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.success,
  },
  busText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: fontSize.small },
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
