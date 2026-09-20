import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createStore } from '../../data/store.js';
import { createApp } from '../app.js';

describe('errorHandler ante un cuerpo JSON mal formado', () => {
  it('devuelve 400 INVALID_JSON en vez del 500 de respaldo', async () => {
    const app = createApp(createStore({ rooms: [], bookings: [] }));

    const response = await request(app)
      .post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send('{ esto no es json');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_JSON');
  });
});
