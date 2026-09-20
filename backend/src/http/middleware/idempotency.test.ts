import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Config } from '../../config.js';
import { createStore } from '../../data/store.js';
import type { Room } from '../../domain/types.js';
import { createApp } from '../app.js';

const rooms: Room[] = [
  { id: 'sala-norte', name: 'Sala Norte', openTime: '09:00', closeTime: '20:00', bufferMinutes: 15 },
];

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 3000,
    latencyMinMs: 0,
    latencyMaxMs: 0,
    failRate: 0,
    rateLimitMax: 1000,
    rateLimitWindowMs: 10000,
    idempotencyTtlMs: 600000,
    ...overrides,
  };
}

function bookingPayload(overrides: Partial<Record<string, string>> = {}) {
  return {
    roomId: 'sala-norte',
    title: 'Reserva de prueba',
    client: 'Cliente de prueba',
    start: '2026-09-09T09:00:00.000Z',
    end: '2026-09-09T10:00:00.000Z',
    ...overrides,
  };
}

describe('idempotencia en POST /api/bookings', () => {
  it('reintentar con la misma clave devuelve la reserva ya creada, con 200, sin duplicarla', async () => {
    const store = createStore({ rooms, bookings: [] });
    const app = createApp(store, baseConfig());

    const first = await request(app)
      .post('/api/bookings')
      .set('Idempotency-Key', 'clave-1')
      .send(bookingPayload());
    expect(first.status).toBe(201);

    const retry = await request(app)
      .post('/api/bookings')
      .set('Idempotency-Key', 'clave-1')
      .send(bookingPayload());
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(first.body.id);

    const listResponse = await request(app).get('/api/bookings');
    expect(listResponse.body.total).toBe(1);
  });

  it('sin cabecera Idempotency-Key, dos peticiones iguales crean dos reservas', async () => {
    const store = createStore({ rooms, bookings: [] });
    const app = createApp(store, baseConfig());

    await request(app)
      .post('/api/bookings')
      .send(bookingPayload({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }));
    await request(app)
      .post('/api/bookings')
      .send(bookingPayload({ start: '2026-09-09T11:00:00.000Z', end: '2026-09-09T12:00:00.000Z' }));

    const listResponse = await request(app).get('/api/bookings');
    expect(listResponse.body.total).toBe(2);
  });

  it('una clave ya usada no crea una reserva nueva aunque el cuerpo cambie', async () => {
    const store = createStore({ rooms, bookings: [] });
    const app = createApp(store, baseConfig());

    const first = await request(app)
      .post('/api/bookings')
      .set('Idempotency-Key', 'clave-2')
      .send(bookingPayload({ title: 'Título original' }));
    expect(first.status).toBe(201);

    const retryWithDifferentBody = await request(app)
      .post('/api/bookings')
      .set('Idempotency-Key', 'clave-2')
      .send(
        bookingPayload({
          title: 'Título distinto',
          start: '2026-09-09T13:00:00.000Z',
          end: '2026-09-09T14:00:00.000Z',
        }),
      );

    expect(retryWithDifferentBody.status).toBe(200);
    expect(retryWithDifferentBody.body.title).toBe('Título original');

    const listResponse = await request(app).get('/api/bookings');
    expect(listResponse.body.total).toBe(1);
  });

  it('una escritura fallida por caos no queda cacheada: un reintento con la misma clave sí crea la reserva', async () => {
    const store = createStore({ rooms, bookings: [] });
    const config = baseConfig({ failRate: 1 });
    const app = createApp(store, config);

    const failedAttempt = await request(app)
      .post('/api/bookings')
      .set('Idempotency-Key', 'clave-3')
      .send(bookingPayload());
    expect(failedAttempt.status).toBe(503);

    config.failRate = 0;

    const retryAfterFailure = await request(app)
      .post('/api/bookings')
      .set('Idempotency-Key', 'clave-3')
      .send(bookingPayload());
    expect(retryAfterFailure.status).toBe(201);

    const listResponse = await request(app).get('/api/bookings');
    expect(listResponse.body.total).toBe(1);
  });

  it('la idempotencia no aplica a PATCH ni DELETE', async () => {
    const store = createStore({
      rooms,
      bookings: [
        {
          id: 'b1',
          roomId: 'sala-norte',
          title: 'Existente',
          client: 'Cliente',
          start: '2026-09-09T09:00:00.000Z',
          end: '2026-09-09T10:00:00.000Z',
          status: 'pending',
          version: 1,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    });
    const app = createApp(store, baseConfig());

    const patchResponse = await request(app)
      .patch('/api/bookings/b1')
      .set('Idempotency-Key', 'clave-4')
      .send({ version: 1, status: 'confirmed' });
    expect(patchResponse.status).toBe(200);

    const repeatedPatch = await request(app)
      .patch('/api/bookings/b1')
      .set('Idempotency-Key', 'clave-4')
      .send({ version: 2, status: 'cancelled' });
    expect(repeatedPatch.status).toBe(200);
    expect(repeatedPatch.body.status).toBe('cancelled');
  });
});
