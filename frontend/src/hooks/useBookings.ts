import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, listBookings, updateBooking } from '../api/client';
import type { Booking, BookingStatus } from '../api/types';

export type BookingsFilters = {
  q?: string;
  roomId?: string;
  status?: string;
  from?: string;
  to?: string;
};

export type UseBookingsResult = {
  items: Booking[];
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
  updateBookingStatus: (booking: Booking, status: BookingStatus) => Promise<void>;
};

const PAGE_LIMIT = 10;

function isBookingLike(value: unknown): value is Booking {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'version' in value &&
    'status' in value
  );
}

export function useBookings(filters: BookingsFilters): UseBookingsResult {
  const [items, setItems] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Dos capas contra respuestas obsoletas: el AbortController cancela de
  // verdad la petición de red, y el requestId ignora una respuesta que, en
  // un test o en una condición de carrera real, llegue de todos modos.
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startNewRequest = useCallback((): { requestId: number; signal: AbortSignal } => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    requestIdRef.current += 1;
    return { requestId: requestIdRef.current, signal: controller.signal };
  }, []);

  const fetchFirstPage = useCallback(() => {
    const { requestId, signal } = startNewRequest();
    setIsLoading(true);
    setError(null);

    listBookings({ ...filters, limit: PAGE_LIMIT }, signal)
      .then((response) => {
        if (requestIdRef.current !== requestId) return;
        setItems(response.items);
        setTotal(response.total);
        setNextCursor(response.nextCursor);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error('Error desconocido al listar reservas.'));
        setIsLoading(false);
      });
  }, [filters.q, filters.roomId, filters.status, filters.from, filters.to, startNewRequest]);

  useEffect(() => {
    fetchFirstPage();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchFirstPage]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || isLoading || nextCursor === null) return;

    const { requestId, signal } = startNewRequest();
    setIsLoadingMore(true);
    setError(null);

    listBookings({ ...filters, limit: PAGE_LIMIT, cursor: nextCursor }, signal)
      .then((response) => {
        if (requestIdRef.current !== requestId) return;
        setItems((current) => [...current, ...response.items]);
        setTotal(response.total);
        setNextCursor(response.nextCursor);
        setIsLoadingMore(false);
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error('Error desconocido al listar reservas.'));
        setIsLoadingMore(false);
      });
  }, [filters, nextCursor, isLoadingMore, isLoading, startNewRequest]);

  const reload = useCallback(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  const updateBookingStatus = useCallback(
    async (booking: Booking, status: BookingStatus): Promise<void> => {
      const previous = booking;

      // Optimista: se ve el cambio antes de que responda el servidor.
      setItems((current) => current.map((b) => (b.id === booking.id ? { ...b, status } : b)));

      try {
        const updated = await updateBooking(booking.id, { version: booking.version, status });
        setItems((current) => current.map((b) => (b.id === booking.id ? updated : b)));
      } catch (err) {
        if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
          const serverCurrent = err.details?.current;
          // Si el servidor no manda una reserva válida en details.current (no
          // debería pasar, pero no hay que confiar ciegamente en la forma de
          // un error), se deshace el optimismo en vez de dejarlo aplicado.
          const restored = isBookingLike(serverCurrent) ? serverCurrent : previous;
          setItems((current) => current.map((b) => (b.id === booking.id ? restored : b)));
        } else {
          // Cualquier otro fallo (negocio o de red): se deshace el optimismo.
          setItems((current) => current.map((b) => (b.id === booking.id ? previous : b)));
        }
        throw err;
      }
    },
    [],
  );

  return {
    items,
    total,
    isLoading,
    isLoadingMore,
    error,
    hasMore: nextCursor !== null,
    loadMore,
    reload,
    updateBookingStatus,
  };
}
