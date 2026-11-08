import { StaticRouteMap, type RouteMapProps } from './StaticRouteMap';

// Web: react-native-maps no tiene soporte web, así que se usa el mapa ilustrativo.
// En iOS y Android, Metro resuelve RouteMap.native.tsx (mapa real de Montería).
export function RouteMap(props: RouteMapProps) {
  return <StaticRouteMap {...props} />;
}
