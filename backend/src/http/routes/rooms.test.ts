import { DateTime } from 'luxon';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createStore } from '../../data/store.js';
import { STUDIO_TIME_ZONE } from '../../domain/availability.js';
import type { Room } from '../../domain/types.js';
import { createApp } from '../app.js';

// Suficientemente lejos en el futuro para que ningún hueco quede filtrado por "ya empezado".
const FUTURE_DATE = DateTime.now().setZone(STUDIO_TIME_ZONE).plus({ days: 30 }).toISODate() as string;

const rooms: Room[] = [
  { id: 'sala-norte', name: 'Sala Norte', openTime: '09:00', closeTime: '20:00', bufferMinutes: 15 },
  { id: 'sala-sur', name: 'Sala Sur', openTime: '10:00', closeTime: '22:00', bufferMinutes: 30 },
  { id: 'cabina-voz', name: 'Cabina de Voz', openTime: '08:00', closeTime: '18:00', bufferMinutes: 0 },
];

function makeApp() {
  return createApp(createStore({ rooms, bookings: [] }));
}

describe('GET /api/rooms', () => {
  it('lista las 3 salas del seed', async () => {
    const response = await request(makeApp()).get('/api/rooms');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(response.body.map((room: Room) => room.id).sort()).toEqual([
      'cabina-voz',
      'sala-norte',
      'sala-sur',
    ]);
  });
});

describe('GET /api/rooms/:id/availability', () => {
  it('devuelve 404 si la sala no existe', async () => {
    const response = await request(makeApp()).get('/api/rooms/no-existe/availability').query({
      date: FUTURE_DATE,
      durationMinutes: 60,
    });
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NOT_FOUND');
  });

  it('devuelve 422 si falta o es inválido el parámetro date', async () => {
    const response = await request(makeApp())
      .get('/api/rooms/sala-norte/availability')
      .query({ durationMinutes: 60 });
    expect(response.status).toBe(422);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details.field).toBe('date');
  });

  it('devuelve 422 si durationMinutes no es un entero positivo', async () => {
    const response = await request(makeApp())
      .get('/api/rooms/sala-norte/availability')
      .query({ date: FUTURE_DATE, durationMinutes: 'abc' });
    expect(response.status).toBe(422);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details.field).toBe('durationMinutes');
  });

  it('devuelve huecos libres para una sala vacía, empezando en la apertura', async () => {
    const response = await request(makeApp())
      .get('/api/rooms/sala-norte/availability')
      .query({ date: FUTURE_DATE, durationMinutes: 60 });

    expect(response.status).toBe(200);
    expect(response.body.roomId).toBe('sala-norte');
    expect(response.body.timeZone).toBe('Europe/Madrid');
    expect(response.body.slots.length).toBeGreaterThan(0);

    const firstSlotLocal = DateTime.fromISO(response.body.slots[0].start, { zone: 'utc' }).setZone(
      STUDIO_TIME_ZONE,
    );
    expect(firstSlotLocal.toFormat('HH:mm')).toBe('09:00');
  });
});
