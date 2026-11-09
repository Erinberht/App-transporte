import { useEffect, useState } from 'react';

/** Hora actual (ms) que se actualiza cada `everyMs`, para textos como "Llega en 4 min". */
export function useNow(everyMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
