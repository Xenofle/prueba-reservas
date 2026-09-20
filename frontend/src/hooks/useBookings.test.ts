import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { Booking, ListBookingsResponse } from '../api/types';
import type { BookingsFilters } from './useBookings';
import { useBookings } from './useBookings';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    listBookings: vi.fn(),
    updateBooking: vi.fn(),
  };
});

const { listBookings, updateBooking } = await import('../api/client');
const listBookingsMock = vi.mocked(listBookings);
const updateBookingMock = vi.mocked(updateBooking);

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    roomId: 'sala-norte',
    title: 'Ensayo',
    client: 'Cliente',
    start: '2026-09-09T09:00:00.000Z',
    end: '2026-09-09T10:00:00.000Z',
    status: 'pending',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('paginación por cursor', () => {
  it('carga la primera página y "cargar más" añade la siguiente sin repetir', async () => {
    const firstPage: ListBookingsResponse = {
      items: [makeBooking({ id: 'a' })],
      nextCursor: 'cursor-1',
      total: 2,
    };
    const secondPage: ListBookingsResponse = {
      items: [makeBooking({ id: 'b' })],
      nextCursor: null,
      total: 2,
    };
    listBookingsMock.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    const { result } = renderHook(() => useBookings({}));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((b) => b.id)).toEqual(['a']);
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));
    expect(result.current.items.map((b) => b.id)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(false);
    expect(listBookingsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1' }),
      expect.anything(),
    );
  });
});

describe('cancelación de peticiones obsoletas', () => {
  it('una respuesta vieja no pisa a la nueva cuando cambian los filtros', async () => {
    const first = deferred<ListBookingsResponse>();
    const second = deferred<ListBookingsResponse>();
    listBookingsMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook((filters: BookingsFilters) => useBookings(filters), {
      initialProps: { roomId: 'sala-norte' },
    });

    rerender({ roomId: 'sala-sur' });

    second.resolve({ items: [makeBooking({ id: 'nuevo' })], nextCursor: null, total: 1 });
    await waitFor(() => expect(result.current.items.map((b) => b.id)).toEqual(['nuevo']));

    first.resolve({ items: [makeBooking({ id: 'viejo' })], nextCursor: null, total: 1 });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.items.map((b) => b.id)).toEqual(['nuevo']);
  });

  it('cancela con AbortController la petición anterior cuando cambian los filtros', () => {
    let capturedSignal: AbortSignal | undefined;
    listBookingsMock.mockImplementationOnce((_params, signal) => {
      capturedSignal = signal;
      return new Promise<ListBookingsResponse>(() => {});
    });
    listBookingsMock.mockImplementationOnce(() => new Promise<ListBookingsResponse>(() => {}));

    const { rerender } = renderHook((filters: BookingsFilters) => useBookings(filters), {
      initialProps: { roomId: 'sala-norte' },
    });

    expect(capturedSignal?.aborted).toBe(false);

    rerender({ roomId: 'sala-sur' });

    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe('escrituras optimistas', () => {
  it('el cambio optimista se deshace si la escritura falla por un error que no es de versión', async () => {
    const booking = makeBooking({ status: 'pending', version: 1 });
    listBookingsMock.mockResolvedValueOnce({ items: [booking], nextCursor: null, total: 1 });

    const { result } = renderHook(() => useBookings({}));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    updateBookingMock.mockRejectedValueOnce(
      new ApiError(422, { error: 'INVALID_TRANSITION', message: 'No se puede confirmar.' }),
    );

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.updateBookingStatus(booking, 'confirmed');
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(ApiError);
    expect(result.current.items[0]?.status).toBe('pending');
    expect(result.current.items[0]?.version).toBe(1);
  });

  it('ante un 409 VERSION_CONFLICT, deja los datos del servidor (ni el optimista ni el viejo)', async () => {
    const booking = makeBooking({ status: 'pending', version: 1 });
    listBookingsMock.mockResolvedValueOnce({ items: [booking], nextCursor: null, total: 1 });

    const { result } = renderHook(() => useBookings({}));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const serverCurrent = makeBooking({
      status: 'confirmed',
      version: 3,
      title: 'Cambiado por otra persona',
    });
    updateBookingMock.mockRejectedValueOnce(
      new ApiError(409, {
        error: 'VERSION_CONFLICT',
        message: 'La reserva ha cambiado.',
        details: { current: serverCurrent },
      }),
    );

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.updateBookingStatus(booking, 'cancelled');
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(ApiError);
    expect(result.current.items[0]).toEqual(serverCurrent);
  });
});
