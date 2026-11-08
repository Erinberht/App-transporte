import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_DESTINATION_ID } from '../data/destinations';
import type { LatLng } from '../data/geo';
import { DEFAULT_CLASS_TIME, type ClassTime } from '../lib/classTime';
import { DEFAULT_WALKING, type WalkingPrefs } from '../planner/recommend';
import type { Occupancy } from '../types';

type TripState = {
  /** Destino elegido en "¿A dónde vas?" (ver src/data/destinations.ts). */
  destinationId: string;
  /** Hora de entrada a clase. */
  classTime: ClassTime;
  /** Ubicación del usuario al planear el viaje; null si no dio permiso. Solo en memoria. */
  origin: LatLng | null;
  routeId: string;
  /** Opciones de caminata (como en Moovit): ritmo y límite por tramo. */
  walking: WalkingPrefs;
  occupancy: Occupancy;
  setDestinationId: (id: string) => void;
  setClassTime: (value: ClassTime) => void;
  setOrigin: (value: LatLng | null) => void;
  setRouteId: (id: string) => void;
  setWalking: (value: WalkingPrefs) => void;
  setOccupancy: (value: Occupancy) => void;
  /** Termina el viaje: borra la ubicación y el estado del recorrido. Conserva destino y hora. */
  reset: () => void;
};

const TripContext = createContext<TripState | null>(null);

// Estado del viaje en memoria. Compartir el recorrido vive aparte (src/sharing/liveShare.ts)
// porque también lo usa la tarea de ubicación en segundo plano.
export function TripProvider({ children }: { children: ReactNode }) {
  const [destinationId, setDestinationId] = useState(DEFAULT_DESTINATION_ID);
  const [classTime, setClassTime] = useState<ClassTime>(DEFAULT_CLASS_TIME);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [routeId, setRouteId] = useState('T2');
  const [walking, setWalking] = useState<WalkingPrefs>(DEFAULT_WALKING);
  const [occupancy, setOccupancy] = useState<Occupancy>('medium');

  const value = useMemo<TripState>(
    () => ({
      destinationId,
      classTime,
      origin,
      routeId,
      walking,
      occupancy,
      setDestinationId,
      setClassTime,
      setOrigin,
      setRouteId,
      setWalking,
      setOccupancy,
      reset: () => {
        setOrigin(null);
        setRouteId('T2');
        setOccupancy('medium');
      },
    }),
    [destinationId, classTime, origin, routeId, walking, occupancy],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripState {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip debe usarse dentro de <TripProvider>');
  return ctx;
}
