import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBooking, updateBooking } from './client';
import type { Booking } from './types';

function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => body,
  } as unknown as Response;
}

function getRequestHeaders(call: unknown[]): Record<string, string> {
  const init = call[1] as RequestInit;
  return (init.headers ?? {}) as Record<string, string>;
}

const sampleBooking: Booking = {
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
};

const createInput = {
  roomId: 'sala-norte',
  title: 'Ensayo',
  client: 'Cliente',
  start: '2026-09-09T09:00:00.000Z',
  end: '2026-09-09T10:00:00.000Z',
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('reintentos ante fallos temporales', () => {
  it('reintenta un 503 con backoff creciente (300ms, luego 600ms)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(503, { error: 'UPSTREAM_UNAVAILABLE', message: 'fallo' }))
      .mockResolvedValueOnce(mockResponse(503, { error: 'UPSTREAM_UNAVAILABLE', message: 'fallo' }))
      .mockResolvedValueOnce(mockResponse(201, sampleBooking));
    vi.stubGlobal('fetch', fetchMock);

    const promise = createBooking(createInput);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(299);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(599);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toEqual(sampleBooking);
  });

  it('respeta el Retry-After de un 429, no un backoff propio', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(429, { error: 'RATE_LIMITED', message: 'despacio' }, { 'Retry-After': '2' }),
      )
      .mockResolvedValueOnce(mockResponse(201, sampleBooking));
    vi.stubGlobal('fetch', fetchMock);

    const promise = createBooking(createInput);
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await expect(promise).resolves.toEqual(sampleBooking);
  });

  it('manda la misma Idempotency-Key en todos los reintentos del mismo envío', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(503, { error: 'UPSTREAM_UNAVAILABLE', message: 'fallo' }))
      .mockResolvedValueOnce(mockResponse(503, { error: 'UPSTREAM_UNAVAILABLE', message: 'fallo' }))
      .mockResolvedValueOnce(mockResponse(201, sampleBooking));
    vi.stubGlobal('fetch', fetchMock);

    const promise = createBooking(createInput);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(600);
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const idempotencyKeys = fetchMock.mock.calls.map(
      (call) => getRequestHeaders(call)['Idempotency-Key'],
    );
    expect(idempotencyKeys.every((key) => typeof key === 'string' && key.length > 0)).toBe(true);
    expect(new Set(idempotencyKeys).size).toBe(1);
  });
});

describe('errores de negocio: no se reintentan', () => {
  it('no reintenta un 409 VERSION_CONFLICT', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      mockResponse(409, {
        error: 'VERSION_CONFLICT',
        message: 'La reserva ha cambiado.',
        details: { current: sampleBooking },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateBooking('b1', { version: 1, status: 'confirmed' })).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
      status: 409,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('no reintenta un 422 VALIDATION_ERROR', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      mockResponse(422, {
        error: 'VALIDATION_ERROR',
        message: 'Título inválido.',
        details: { field: 'title' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createBooking({ ...createInput, title: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
