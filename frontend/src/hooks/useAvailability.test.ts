import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AvailabilityResponse } from '../api/types';
import type { AvailabilityParams } from './useAvailability';
import { useAvailability } from './useAvailability';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    getAvailability: vi.fn(),
  };
});

const { getAvailability } = await import('../api/client');
const getAvailabilityMock = vi.mocked(getAvailability);

function makeResponse(overrides: Partial<AvailabilityResponse> = {}): AvailabilityResponse {
  return {
    roomId: 'sala-norte',
    date: '2026-09-09',
    durationMinutes: 60,
    timeZone: 'Europe/Madrid',
    slots: [{ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }],
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

describe('useAvailability', () => {
  it('con params en null no pide nada a la API', () => {
    renderHook(() => useAvailability(null));
    expect(getAvailabilityMock).not.toHaveBeenCalled();
  });

  it('pide los huecos cuando hay sala, día y duración', async () => {
    getAvailabilityMock.mockResolvedValueOnce(makeResponse());

    const { result } = renderHook(() =>
      useAvailability({ roomId: 'sala-norte', date: '2026-09-09', durationMinutes: 60 }),
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.slots).toEqual([{ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }]);
    expect(getAvailabilityMock).toHaveBeenCalledWith(
      'sala-norte',
      { date: '2026-09-09', durationMinutes: 60 },
      expect.anything(),
    );
  });

  it('cambiar sala, día o duración cancela la petición anterior y pide una nueva', async () => {
    let firstSignal: AbortSignal | undefined;
    getAvailabilityMock.mockImplementationOnce((_roomId, _params, signal) => {
      firstSignal = signal;
      return new Promise<AvailabilityResponse>(() => {});
    });
    getAvailabilityMock.mockResolvedValueOnce(makeResponse({ roomId: 'sala-sur' }));

    const { result, rerender } = renderHook((params: AvailabilityParams) => useAvailability(params), {
      initialProps: { roomId: 'sala-norte', date: '2026-09-09', durationMinutes: 60 },
    });

    expect(firstSignal?.aborted).toBe(false);

    rerender({ roomId: 'sala-sur', date: '2026-09-09', durationMinutes: 60 });

    expect(firstSignal?.aborted).toBe(true);
    expect(getAvailabilityMock).toHaveBeenCalledTimes(2);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('una respuesta vieja no pisa a la nueva', async () => {
    const first = deferred<AvailabilityResponse>();
    const second = deferred<AvailabilityResponse>();
    getAvailabilityMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook((params: AvailabilityParams) => useAvailability(params), {
      initialProps: { roomId: 'sala-norte', date: '2026-09-09', durationMinutes: 60 },
    });

    rerender({ roomId: 'sala-norte', date: '2026-09-10', durationMinutes: 60 });

    second.resolve(makeResponse({ date: '2026-09-10', slots: [{ start: 'nuevo-start', end: 'nuevo-end' }] }));
    await waitFor(() => expect(result.current.slots).toEqual([{ start: 'nuevo-start', end: 'nuevo-end' }]));

    first.resolve(makeResponse({ slots: [{ start: 'viejo-start', end: 'viejo-end' }] }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.slots).toEqual([{ start: 'nuevo-start', end: 'nuevo-end' }]);
  });

  it('reload() vuelve a pedir los mismos huecos', async () => {
    getAvailabilityMock.mockResolvedValue(makeResponse());

    const { result } = renderHook(() =>
      useAvailability({ roomId: 'sala-norte', date: '2026-09-09', durationMinutes: 60 }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getAvailabilityMock).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(getAvailabilityMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('si falla la petición, expone el error', async () => {
    getAvailabilityMock.mockRejectedValueOnce(new Error('fallo de red'));

    const { result } = renderHook(() =>
      useAvailability({ roomId: 'sala-norte', date: '2026-09-09', durationMinutes: 60 }),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('fallo de red');
    expect(result.current.slots).toEqual([]);
  });
});
