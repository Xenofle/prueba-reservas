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
    rateLimitMax: 2,
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

describe('límite de escrituras', () => {
  it('permite hasta rateLimitMax escrituras y bloquea la siguiente con 429 y Retry-After', async () => {
    const store = createStore({ rooms, bookings: [] });
    const app = createApp(store, baseConfig());

    const first = await request(app)
      .post('/api/bookings')
      .send(bookingPayload({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }));
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/bookings')
      .send(bookingPayload({ start: '2026-09-09T11:00:00.000Z', end: '2026-09-09T12:00:00.000Z' }));
    expect(second.status).toBe(201);

    const third = await request(app)
      .post('/api/bookings')
      .send(bookingPayload({ start: '2026-09-09T13:00:00.000Z', end: '2026-09-09T14:00:00.000Z' }));

    expect(third.status).toBe(429);
    expect(third.body.error).toBe('RATE_LIMITED');
    expect(third.headers['retry-after']).toBeDefined();
    expect(Number(third.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('no cuenta las lecturas contra el límite de escrituras', async () => {
    const store = createStore({ rooms, bookings: [] });
    const app = createApp(store, baseConfig({ rateLimitMax: 1 }));

    await request(app).get('/api/rooms');
    await request(app).get('/api/rooms');
    await request(app).get('/api/rooms');

    const write = await request(app).post('/api/bookings').send(bookingPayload());
    expect(write.status).toBe(201);
  });

  it('los replays de una misma Idempotency-Key no consumen cupo de rate limit', async () => {
    const store = createStore({ rooms, bookings: [] });
    const app = createApp(store, baseConfig({ rateLimitMax: 2 }));

    const first = await request(app)
      .post('/api/bookings')
      .set('Idempotency-Key', 'clave-replay')
      .send(bookingPayload({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }));
    expect(first.status).toBe(201);

    for (let i = 0; i < 5; i++) {
      const replay = await request(app)
        .post('/api/bookings')
        .set('Idempotency-Key', 'clave-replay')
        .send(bookingPayload({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }));
      expect(replay.status).toBe(200);
      expect(replay.body.id).toBe(first.body.id);
    }

    // Queda un segundo cupo real (rateLimitMax=2): si los replays lo hubieran
    // gastado, esta escritura distinta ya estaría bloqueada con 429.
    const second = await request(app)
      .post('/api/bookings')
      .send(bookingPayload({ start: '2026-09-09T11:00:00.000Z', end: '2026-09-09T12:00:00.000Z' }));
    expect(second.status).toBe(201);

    const third = await request(app)
      .post('/api/bookings')
      .send(bookingPayload({ start: '2026-09-09T13:00:00.000Z', end: '2026-09-09T14:00:00.000Z' }));
    expect(third.status).toBe(429);
  });
});
