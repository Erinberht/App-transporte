import type { LatLng } from './geo';

export type Destination = {
  id: string;
  /** Nombre corto que se muestra en la lista. */
  name: string;
  /** Sede, campus o referencia del lugar. */
  detail: string;
  coordinate: LatLng;
};

// ÚNICA lista de destinos de la app. Por ahora solo la sede Montería de la Universidad de
// Córdoba (campus principal). Para agregar destinos más adelante (otras sedes u otros lugares
// de Montería) basta con añadirlos aquí: la pantalla "¿A dónde vas?" los lista automáticamente.
export const DESTINATIONS: Destination[] = [
  {
    id: 'unicordoba-monteria',
    name: 'Universidad de Córdoba',
    detail: 'Sede Montería · campus principal',
    // Coordenadas aproximadas del campus; verificar al cargar los datos reales de rutas.
    coordinate: { latitude: 8.7905, longitude: -75.859 },
  },
];

export const DEFAULT_DESTINATION_ID = DESTINATIONS[0].id;

export function getDestination(id: string): Destination {
  return DESTINATIONS.find((d) => d.id === id) ?? DESTINATIONS[0];
}
