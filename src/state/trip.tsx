import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Occupancy } from '../types';

type TripState = {
  routeId: string;
  occupancy: Occupancy;
  sharing: boolean;
  setRouteId: (id: string) => void;
  setOccupancy: (value: Occupancy) => void;
  setSharing: (value: boolean) => void;
  reset: () => void;
};

const TripContext = createContext<TripState | null>(null);

// Estado del viaje en memoria. Cuando exista backend, esto pasa a hablar con la API
// (ubicación en vivo, reportes de cupo) y se persiste lo que haga falta.
export function TripProvider({ children }: { children: ReactNode }) {
  const [routeId, setRouteId] = useState('T2');
  const [occupancy, setOccupancy] = useState<Occupancy>('medium');
  const [sharing, setSharing] = useState(false);

  const value = useMemo<TripState>(
    () => ({
      routeId,
      occupancy,
      sharing,
      setRouteId,
      setOccupancy,
      setSharing,
      reset: () => {
        setRouteId('T2');
        setOccupancy('medium');
        setSharing(false);
      },
    }),
    [routeId, occupancy, sharing],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripState {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip debe usarse dentro de <TripProvider>');
  return ctx;
}
