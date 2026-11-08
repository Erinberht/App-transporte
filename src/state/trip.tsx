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
  sharing: boolean;
  setDestinationId: (id: string) => void;
  setClassTime: (value: ClassTime) => void;
  setOrigin: (value: LatLng | null) => void;
  setRouteId: (id: string) => void;
  setWalking: (value: WalkingPrefs) => void;
  setOccupancy: (value: Occupancy) => void;
  setSharing: (value: boolean) => void;
  /** Termina el viaje: borra la ubicación y el estado del recorrido. Conserva destino y hora. */
  reset: () => void;
};

const TripContext = createContext<TripState | null>(null);

// Estado del viaje en memoria. Cuando exista backend, esto pasa a hablar con la API
// (ubicación en vivo, reportes de cupo) y se persiste lo que haga falta.
export function TripProvider({ children }: { children: ReactNode }) {
  const [destinationId, setDestinationId] = useState(DEFAULT_DESTINATION_ID);
  const [classTime, setClassTime] = useState<ClassTime>(DEFAULT_CLASS_TIME);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [routeId, setRouteId] = useState('T2');
  const [walking, setWalking] = useState<WalkingPrefs>(DEFAULT_WALKING);
  const [occupancy, setOccupancy] = useState<Occupancy>('medium');
  const [sharing, setSharing] = useState(false);

  const value = useMemo<TripState>(
    () => ({
      destinationId,
      classTime,
      origin,
      routeId,
      walking,
      occupancy,
      sharing,
      setDestinationId,
      setClassTime,
      setOrigin,
      setRouteId,
      setWalking,
      setOccupancy,
      setSharing,
      reset: () => {
        setOrigin(null);
        setRouteId('T2');
        setOccupancy('medium');
        setSharing(false);
      },
    }),
    [destinationId, classTime, origin, routeId, walking, occupancy, sharing],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripState {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip debe usarse dentro de <TripProvider>');
  return ctx;
}
