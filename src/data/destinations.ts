import type { Place, PlaceIcon } from '../profile/model';
import type { LatLng } from './geo';

export type Destination = {
  id: string;
  /** Nombre corto que se muestra en la lista. */
  name: string;
  /** Sede, campus o referencia del lugar. */
  detail: string;
  coordinate: LatLng;
  /** 'campus': la universidad (hay clase). 'place': lugar frecuente que guardó el usuario. */
  kind: 'campus' | 'place';
  icon: PlaceIcon | 'campus';
};

// Destinos fijos de la app: solo la sede Montería de la Universidad de Córdoba (campus
// principal). No se agregan otras sedes. Los demás destinos son los lugares frecuentes que el
// usuario guarda en su perfil (src/profile), que se suman a esta lista.
export const DESTINATIONS: Destination[] = [
  {
    id: 'unicordoba-monteria',
    name: 'Universidad de Córdoba',
    detail: 'Sede Montería · campus principal',
    // Coordenadas aproximadas del campus; verificar al cargar los datos reales de rutas.
    coordinate: { latitude: 8.7905, longitude: -75.859 },
    kind: 'campus',
    icon: 'campus',
  },
];

export const DEFAULT_DESTINATION_ID = DESTINATIONS[0].id;

const PLACE_DETAIL: Record<PlaceIcon, string> = {
  home: 'Tu casa',
  work: 'Tu trabajo',
  other: 'Lugar guardado',
};

export function placeToDestination(place: Place): Destination {
  return {
    id: `place:${place.id}`,
    name: place.name,
    detail: PLACE_DETAIL[place.icon],
    coordinate: place.coordinate,
    kind: 'place',
    icon: place.icon,
  };
}

/** La universidad y, después, los lugares del usuario. */
export function allDestinations(places: Place[] = []): Destination[] {
  return [...DESTINATIONS, ...places.map(placeToDestination)];
}

/** Destino por id; si no existe (ej. se borró el lugar), la universidad. */
export function getDestination(id: string, places: Place[] = []): Destination {
  return allDestinations(places).find((d) => d.id === id) ?? DESTINATIONS[0];
}
