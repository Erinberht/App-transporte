// Geografía de MUESTRA para el mapa real. Las coordenadas son aproximadas e ilustrativas:
// un recorrido inventado entre el centro de Montería y la sede central de la Universidad de
// Córdoba. Se reemplazan por los recorridos reales (paradas + polilínea por ruta) cuando
// exista el modelo de datos de rutas.

export type LatLng = { latitude: number; longitude: number };

/** Centro aproximado de Montería (Córdoba, Colombia). */
export const MONTERIA_CENTER: LatLng = { latitude: 8.7575, longitude: -75.8851 };

/** Parada del usuario (muestra). */
export const SAMPLE_USER_STOP: LatLng = { latitude: 8.759, longitude: -75.879 };

/** Recorrido de muestra: parada del usuario -> universidad. */
export const SAMPLE_ROUTE_PATH: LatLng[] = [
  SAMPLE_USER_STOP,
  { latitude: 8.764, longitude: -75.878 },
  { latitude: 8.77, longitude: -75.874 },
  { latitude: 8.776, longitude: -75.87 },
  { latitude: 8.782, longitude: -75.866 },
  { latitude: 8.787, longitude: -75.862 },
  { latitude: 8.7905, longitude: -75.859 },
];

/** Posición de muestra del bus sobre el recorrido. */
export const SAMPLE_BUS_POSITION: LatLng = SAMPLE_ROUTE_PATH[2];

/** Región que encuadra todos los puntos, con un margen alrededor. */
export function regionFor(points: LatLng[], padding = 1.4) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * padding, 0.005),
    longitudeDelta: Math.max((maxLng - minLng) * padding, 0.005),
  };
}
