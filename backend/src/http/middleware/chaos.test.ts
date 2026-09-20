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

describe('fallo simulado del 20% en escrituras', () => {
  it('con failRate=1 siempre responde 503 y no crea la reserva', async () => {
    const store = createStore({ rooms, bookings: [] });
    const app = createApp(store, baseConfig({ failRate: 1 }));

    const response = await request(app).post('/api/bookings').send(bookingPayload());
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('UPSTREAM_UNAVAILABLE');

    const listResponse = await request(app).get('/api/bookings');
    expect(listResponse.body.total).toBe(0);
  });

  it('con failRate=0 nunca falla por caos', async () => {
    const store = createStore({ rooms, bookings: [] });
    const app = createApp(store, baseConfig({ failRate: 0 }));

    const response = await request(app).post('/api/bookings').send(bookingPayload());
    expect(response.status).toBe(201);
  });

  it('no afecta a las lecturas aunque failRate sea 1', async () => {
    const store = createStore({ rooms, bookings: [] });
    const app = createApp(store, baseConfig({ failRate: 1 }));

    const response = await request(app).get('/api/rooms');
    expect(response.status).toBe(200);
  });

  it('un PATCH que falla por caos no cambia la versión ni el estado', async () => {
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
    const app = createApp(store, baseConfig({ failRate: 1 }));

    const response = await request(app).patch('/api/bookings/b1').send({ version: 1, status: 'confirmed' });
    expect(response.status).toBe(503);

    const current = await request(app).get('/api/bookings/b1');
    expect(current.body.status).toBe('pending');
    expect(current.body.version).toBe(1);
  });
});
