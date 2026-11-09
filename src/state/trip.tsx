import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_DESTINATION_ID } from '../data/destinations';
import type { LatLng } from '../data/geo';
import { DEFAULT_CLASS_TIME, type ClassTime } from '../lib/classTime';
import { DEFAULT_WALKING, type WalkingPrefs } from '../planner/recommend';
import type { Occupancy } from '../types';

/** Bus vinculado al escanear su QR (src/qr). */
export type LinkedBus = { id: string; code: string; routeId: string };

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
  /** Último cupo que reportó el usuario en este viaje (null: aún no reporta). */
  occupancy: Occupancy | null;
  /** Bus del QR escaneado; solo vale si es de la ruta elegida (ver linkedBusFor). */
  bus: LinkedBus | null;
  setDestinationId: (id: string) => void;
  setClassTime: (value: ClassTime) => void;
  setOrigin: (value: LatLng | null) => void;
  setRouteId: (id: string) => void;
  setWalking: (value: WalkingPrefs) => void;
  setOccupancy: (value: Occupancy | null) => void;
  setBus: (value: LinkedBus | null) => void;
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
  const [occupancy, setOccupancy] = useState<Occupancy | null>(null);
  const [bus, setBus] = useState<LinkedBus | null>(null);

  const value = useMemo<TripState>(
    () => ({
      destinationId,
      classTime,
      origin,
      routeId,
      walking,
      occupancy,
      bus,
      setDestinationId,
      setClassTime,
      setOrigin,
      setRouteId,
      setWalking,
      setOccupancy,
      setBus,
      reset: () => {
        setOrigin(null);
        setRouteId('T2');
        setOccupancy(null);
        setBus(null);
      },
    }),
    [destinationId, classTime, origin, routeId, walking, occupancy, bus],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripState {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip debe usarse dentro de <TripProvider>');
  return ctx;
}

/** El bus vinculado, solo si es de la ruta que se va a compartir. */
export function linkedBusFor(bus: LinkedBus | null, routeId: string): LinkedBus | null {
  return bus && bus.routeId === routeId ? bus : null;
}
