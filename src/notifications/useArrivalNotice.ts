import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import { arrivalNotice } from './plan';
import { setArrivalNotice } from './scheduler';

type Input = {
  routeId: string;
  routeName: string;
  stopId: string;
  stopName: string;
  boardAt: Date;
  walkToStopMinutes: number;
};

/**
 * Alerta de llegada mientras la pantalla "Esperando tu bus" está abierta (aunque la app quede en
 * segundo plano). Se reprograma si cambia la hora de paso y se cancela al salir de la pantalla
 * (ej. "Ya subí"). Si ya está por sonar, no se toca: reprogramarla podría perderla.
 */
export function useArrivalNotice(input: Input | null) {
  const due = useRef<string | null>(null);
  const trip = input ? `${input.routeId}|${input.stopId}` : null;
  // La hora de paso en minutos: con buses en vivo se mueve un poco en cada lectura.
  const boardMinute = input ? Math.round(input.boardAt.getTime() / 60_000) : null;
  const routeName = input?.routeName ?? '';
  const stopName = input?.stopName ?? '';
  const walkToStopMinutes = input?.walkToStopMinutes ?? 0;

  useFocusEffect(
    useCallback(() => {
      if (!trip || boardMinute === null || due.current === trip) return;
      const notice = arrivalNotice({
        boardAt: new Date(boardMinute * 60_000),
        now: new Date(),
        walkToStopMinutes,
        routeName,
        stopName,
      });
      if (notice) setArrivalNotice(notice);
      else due.current = trip; // ya está por pasar: lo programado (si hay) se queda
    }, [trip, boardMinute, routeName, stopName, walkToStopMinutes]),
  );

  // Al salir de la pantalla, la alerta ya no sirve.
  useFocusEffect(
    useCallback(
      () => () => {
        due.current = null;
        setArrivalNotice(null);
      },
      [],
    ),
  );
}
