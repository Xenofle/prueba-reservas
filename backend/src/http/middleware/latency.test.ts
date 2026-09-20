import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Config } from '../../config.js';
import { createStore } from '../../data/store.js';
import { createApp } from '../app.js';

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

describe('latencia simulada', () => {
  it('con latencyMinMs/latencyMaxMs en 0 no añade retraso apreciable', async () => {
    const app = createApp(createStore({ rooms: [], bookings: [] }), baseConfig());

    const start = Date.now();
    await request(app).get('/api/health');
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('respeta el rango mínimo configurado de latencia', async () => {
    const app = createApp(
      createStore({ rooms: [], bookings: [] }),
      baseConfig({ latencyMinMs: 80, latencyMaxMs: 120 }),
    );

    const start = Date.now();
    await request(app).get('/api/health');
    expect(Date.now() - start).toBeGreaterThanOrEqual(75);
  });
});
