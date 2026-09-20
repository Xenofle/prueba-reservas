import type {
  ApiErrorBody,
  ApiErrorCode,
  AvailabilityResponse,
  Booking,
  BookingStatus,
  ListBookingsResponse,
  Room,
} from './types';

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 300;
const RETRYABLE_STATUSES = new Set([503, 429]);

export class ApiError extends Error {
  readonly code: ApiErrorCode | 'UNKNOWN_ERROR';
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(status: number, body: Partial<ApiErrorBody> | undefined) {
    super(body?.message ?? `Error inesperado (HTTP ${status}).`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error ?? 'UNKNOWN_ERROR';
    if (body?.details !== undefined) {
      this.details = body.details;
    }
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

async function parseErrorBody(response: Response): Promise<Partial<ApiErrorBody> | undefined> {
  try {
    return (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    return undefined;
  }
}

// 503 (caos): backoff creciente propio. 429 (rate limit): lo que diga
// Retry-After, que es quien de verdad sabe cuándo se libera el cupo.
function retryDelayMs(response: Response, attempt: number): number {
  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader !== null ? Number(retryAfterHeader) : NaN;
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return retryAfterSeconds * 1000;
    }
  }
  return BASE_RETRY_DELAY_MS * 2 ** attempt;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, idempotencyKey } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  if (signal !== undefined) {
    init.signal = signal;
  }

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(path, init);

    if (response.ok) {
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    }

    // Los errores de negocio (409, 422, 404...) no se reintentan: se
    // devuelven tal cual para que quien llame los explique al usuario.
    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      await wait(retryDelayMs(response, attempt), signal);
      continue;
    }

    throw new ApiError(response.status, await parseErrorBody(response));
  }
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// exactOptionalPropertyTypes prohíbe asignar `signal: undefined` explícito a
// una propiedad opcional; se omite la clave entera cuando no hay señal.
function withSignal(
  base: Omit<RequestOptions, 'signal'>,
  signal: AbortSignal | undefined,
): RequestOptions {
  return signal !== undefined ? { ...base, signal } : base;
}

export function getRooms(signal?: AbortSignal): Promise<Room[]> {
  return request<Room[]>('/api/rooms', withSignal({}, signal));
}

export function getAvailability(
  roomId: string,
  params: { date: string; durationMinutes: number },
  signal?: AbortSignal,
): Promise<AvailabilityResponse> {
  const query = new URLSearchParams({
    date: params.date,
    durationMinutes: String(params.durationMinutes),
  });
  return request<AvailabilityResponse>(
    `/api/rooms/${roomId}/availability?${query.toString()}`,
    withSignal({}, signal),
  );
}

export type ListBookingsParams = {
  q?: string;
  roomId?: string;
  status?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export function listBookings(
  params: ListBookingsParams = {},
  signal?: AbortSignal,
): Promise<ListBookingsResponse> {
  const query = new URLSearchParams();
  if (params.q !== undefined) query.set('q', params.q);
  if (params.roomId !== undefined) query.set('roomId', params.roomId);
  if (params.status !== undefined) query.set('status', params.status);
  if (params.from !== undefined) query.set('from', params.from);
  if (params.to !== undefined) query.set('to', params.to);
  if (params.cursor !== undefined) query.set('cursor', params.cursor);
  if (params.limit !== undefined) query.set('limit', String(params.limit));

  const queryString = query.toString();
  return request<ListBookingsResponse>(
    `/api/bookings${queryString ? `?${queryString}` : ''}`,
    withSignal({}, signal),
  );
}

export function getBooking(id: string, signal?: AbortSignal): Promise<Booking> {
  return request<Booking>(`/api/bookings/${id}`, withSignal({}, signal));
}

export type CreateBookingInput = {
  roomId: string;
  title: string;
  client: string;
  start: string;
  end: string;
};

// La clave de idempotencia se genera una vez por envío (aquí) y viaja igual
// en todos los reintentos internos de request(), nunca una nueva por intento.
export function createBooking(input: CreateBookingInput, signal?: AbortSignal): Promise<Booking> {
  return request<Booking>(
    '/api/bookings',
    withSignal({ method: 'POST', body: input, idempotencyKey: generateIdempotencyKey() }, signal),
  );
}

export type UpdateBookingInput = {
  version: number;
  roomId?: string;
  title?: string;
  client?: string;
  start?: string;
  end?: string;
  status?: BookingStatus;
};

export function updateBooking(
  id: string,
  input: UpdateBookingInput,
  signal?: AbortSignal,
): Promise<Booking> {
  return request<Booking>(`/api/bookings/${id}`, withSignal({ method: 'PATCH', body: input }, signal));
}

export function deleteBooking(id: string, version: number, signal?: AbortSignal): Promise<void> {
  return request<void>(
    `/api/bookings/${id}?version=${version}`,
    withSignal({ method: 'DELETE' }, signal),
  );
}
