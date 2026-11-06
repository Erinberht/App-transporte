import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import type { LatLng } from '../data/geo';

export type UserLocationState =
  /** Aún no se ha pedido permiso: se explica para qué sirve antes de pedirlo. */
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'located'; coords: LatLng; accuracy: number | null }
  /** Permiso negado. Si `canAskAgain` es false, solo se puede activar desde Ajustes. */
  | { status: 'denied'; canAskAgain: boolean }
  /** El GPS / los servicios de ubicación del teléfono están apagados. */
  | { status: 'unavailable' }
  | { status: 'error' };

/**
 * Ubicación del usuario en primer plano (sin seguimiento en segundo plano).
 * Solo se lee cuando el usuario lo pide, o automáticamente si ya había dado permiso antes.
 * La ubicación se queda en el teléfono: este hook no la envía a ningún servidor.
 */
export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({ status: 'idle' });

  const locate = useCallback(async () => {
    setState({ status: 'locating' });
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        setState({ status: 'unavailable' });
        return;
      }
      // Primero la última posición conocida (rápida), luego una lectura actual (~100 m).
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 200 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setState({ status: 'located', coords, accuracy: position.coords.accuracy ?? null });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  /** Pide el permiso (si hace falta) y obtiene la ubicación. Sirve también para reintentar. */
  const request = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setState({ status: 'denied', canAskAgain: permission.canAskAgain });
        return;
      }
      await locate();
    } catch {
      setState({ status: 'error' });
    }
  }, [locate]);

  // Si el usuario ya había dado permiso, no se vuelve a preguntar: se ubica directamente.
  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (cancelled) return;
        if (permission.granted) locate();
        else if (permission.status === 'denied' && !permission.canAskAgain)
          setState({ status: 'denied', canAskAgain: false });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locate]);

  return { state, request };
}
