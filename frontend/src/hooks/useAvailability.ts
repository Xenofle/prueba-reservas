import { useCallback, useEffect, useRef, useState } from 'react';
import { getAvailability } from '../api/client';
import type { Slot } from '../api/types';

export type AvailabilityParams = {
  roomId: string;
  date: string;
  durationMinutes: number;
};

export type UseAvailabilityResult = {
  slots: Slot[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
};

// `params` en null significa "todavía no hay sala/día/duración elegidos":
// no se pide nada a la API hasta que los tres campos tengan un valor.
export function useAvailability(params: AvailabilityParams | null): UseAvailabilityResult {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Mismo patrón de dos capas que useBookings: AbortController cancela de
  // verdad la petición anterior, y requestId ignora una respuesta tardía
  // aunque algo no respete la señal de aborto.
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAvailability = useCallback(() => {
    abortControllerRef.current?.abort();

    if (!params) {
      setSlots([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setIsLoading(true);
    setError(null);

    getAvailability(params.roomId, { date: params.date, durationMinutes: params.durationMinutes }, controller.signal)
      .then((response) => {
        if (requestIdRef.current !== requestId) return;
        setSlots(response.slots);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error('Error desconocido al pedir la disponibilidad.'));
        setIsLoading(false);
      });
  }, [params?.roomId, params?.date, params?.durationMinutes]);

  useEffect(() => {
    fetchAvailability();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchAvailability]);

  return { slots, isLoading, error, reload: fetchAvailability };
}
