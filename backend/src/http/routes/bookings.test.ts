import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createStore } from '../../data/store.js';
import type { Booking, Room } from '../../domain/types.js';
import { createApp } from '../app.js';

const rooms: Room[] = [
  { id: 'sala-norte', name: 'Sala Norte', openTime: '09:00', closeTime: '20:00', bufferMinutes: 15 },
  { id: 'sala-sur', name: 'Sala Sur', openTime: '10:00', closeTime: '22:00', bufferMinutes: 30 },
  { id: 'cabina-voz', name: 'Cabina de Voz', openTime: '08:00', closeTime: '18:00', bufferMinutes: 0 },
];

function makeBooking(overrides: Partial<Booking>): Booking {
  return {
    id: 'b0',
    roomId: 'sala-norte',
    title: 'Reunión',
    client: 'Cliente',
    start: '2026-09-09T09:00:00.000Z',
    end: '2026-09-09T10:00:00.000Z',
    status: 'confirmed',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

let app: Express;

beforeEach(() => {
  const bookings: Booking[] = [
    makeBooking({
      id: 'b1',
      roomId: 'sala-norte',
      title: 'Ensayo de banda',
      client: 'Álvaro García',
      start: '2026-09-09T09:00:00.000Z',
      end: '2026-09-09T10:00:00.000Z',
      status: 'confirmed',
    }),
    makeBooking({
      id: 'b2',
      roomId: 'sala-sur',
      title: 'Podcast',
      client: 'Lucía Fernández',
      start: '2026-09-10T09:00:00.000Z',
      end: '2026-09-10T10:00:00.000Z',
      status: 'pending',
    }),
    makeBooking({
      id: 'b3',
      roomId: 'sala-norte',
      title: 'Cancelada',
      client: 'Marta Jiménez',
      start: '2026-09-11T09:00:00.000Z',
      end: '2026-09-11T10:00:00.000Z',
      status: 'cancelled',
    }),
  ];
  app = createApp(createStore({ rooms, bookings }));
});

describe('GET /api/bookings', () => {
  it('lista todas las reservas por defecto, ordenadas por (start, id)', async () => {
    const response = await request(app).get('/api/bookings');
    expect(response.status).toBe(200);
    expect(response.body.items.map((b: Booking) => b.id)).toEqual(['b1', 'b2', 'b3']);
    expect(response.body.total).toBe(3);
    expect(response.body.nextCursor).toBeNull();
  });

  it('filtra por roomId', async () => {
    const response = await request(app).get('/api/bookings').query({ roomId: 'sala-sur' });
    expect(response.body.items.map((b: Booking) => b.id)).toEqual(['b2']);
  });

  it('filtra por status', async () => {
    const response = await request(app).get('/api/bookings').query({ status: 'cancelled' });
    expect(response.body.items.map((b: Booking) => b.id)).toEqual(['b3']);
  });

  it('busca por texto ignorando mayúsculas y acentos', async () => {
    const response = await request(app).get('/api/bookings').query({ q: 'alvaro' });
    expect(response.body.items.map((b: Booking) => b.id)).toEqual(['b1']);
  });

  it('filtra por rango from/to de días locales', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({ from: '2026-09-10', to: '2026-09-10' });
    expect(response.body.items.map((b: Booking) => b.id)).toEqual(['b2']);
  });

  it('pagina con cursor sin saltar ni repetir filas', async () => {
    const firstPage = await request(app).get('/api/bookings').query({ limit: 2 });
    expect(firstPage.body.items.map((b: Booking) => b.id)).toEqual(['b1', 'b2']);
    expect(firstPage.body.nextCursor).not.toBeNull();

    const secondPage = await request(app)
      .get('/api/bookings')
      .query({ limit: 2, cursor: firstPage.body.nextCursor });
    expect(secondPage.body.items.map((b: Booking) => b.id)).toEqual(['b3']);
    expect(secondPage.body.nextCursor).toBeNull();
  });

  it('devuelve 400 INVALID_LIMIT si limit está fuera de rango', async () => {
    const response = await request(app).get('/api/bookings').query({ limit: 999 });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_LIMIT');
  });

  it('devuelve 400 INVALID_CURSOR si el cursor es ilegible', async () => {
    const response = await request(app).get('/api/bookings').query({ cursor: 'no-es-un-cursor-@@@' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_CURSOR');
  });

  it('devuelve 400 INVALID_RANGE si "from" es posterior a "to"', async () => {
    const response = await request(app)
      .get('/api/bookings')
      .query({ from: '2026-09-11', to: '2026-09-09' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_RANGE');
  });
});

describe('GET /api/bookings/:id', () => {
  it('devuelve la reserva', async () => {
    const response = await request(app).get('/api/bookings/b1');
    expect(response.status).toBe(200);
    expect(response.body.id).toBe('b1');
  });

  it('devuelve 404 si no existe', async () => {
    const response = await request(app).get('/api/bookings/no-existe');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NOT_FOUND');
  });
});

describe('POST /api/bookings', () => {
  it('crea una reserva en estado pending con version 1', async () => {
    const response = await request(app).post('/api/bookings').send({
      roomId: 'cabina-voz',
      title: 'Locución nueva',
      client: 'Cliente Nuevo',
      start: '2026-09-12T09:00:00.000Z',
      end: '2026-09-12T10:00:00.000Z',
    });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
    expect(response.body.version).toBe(1);
  });

  it('devuelve 404 si la sala no existe', async () => {
    const response = await request(app).post('/api/bookings').send({
      roomId: 'no-existe',
      title: 'Locución nueva',
      client: 'Cliente Nuevo',
      start: '2026-09-12T09:00:00.000Z',
      end: '2026-09-12T10:00:00.000Z',
    });
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NOT_FOUND');
  });

  it('devuelve 422 VALIDATION_ERROR si falta un campo obligatorio', async () => {
    const response = await request(app).post('/api/bookings').send({
      roomId: 'sala-norte',
      title: 'Locución nueva',
      client: 'Cliente Nuevo',
      start: '2026-09-12T09:00:00.000Z',
    });
    expect(response.status).toBe(422);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('devuelve 422 OUTSIDE_HOURS si no cabe en el horario de la sala', async () => {
    const response = await request(app).post('/api/bookings').send({
      roomId: 'cabina-voz',
      title: 'Fuera de horario',
      client: 'Cliente Nuevo',
      start: '2026-09-12T19:00:00.000Z', // 21:00 local, cabina cierra a las 18:00
      end: '2026-09-12T20:00:00.000Z',
    });
    expect(response.status).toBe(422);
    expect(response.body.error).toBe('OUTSIDE_HOURS');
  });

  it('devuelve 409 OVERLAP si invade otra reserva activa', async () => {
    const response = await request(app).post('/api/bookings').send({
      roomId: 'sala-norte',
      title: 'Choca con b1',
      client: 'Cliente Nuevo',
      start: '2026-09-09T09:30:00.000Z',
      end: '2026-09-09T10:30:00.000Z',
    });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('OVERLAP');
    expect(response.body.details.conflicts).toEqual(['b1']);
  });
});

describe('PATCH /api/bookings/:id', () => {
  it('confirma una reserva pending y sube la versión', async () => {
    const response = await request(app).patch('/api/bookings/b2').send({ version: 1, status: 'confirmed' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('confirmed');
    expect(response.body.version).toBe(2);
  });

  it('devuelve 409 VERSION_CONFLICT con la reserva actual del servidor', async () => {
    const response = await request(app).patch('/api/bookings/b1').send({ version: 99, status: 'cancelled' });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('VERSION_CONFLICT');
    expect(response.body.details.current.id).toBe('b1');
    expect(response.body.details.current.version).toBe(1);
  });

  it('devuelve 422 INVALID_TRANSITION si confirmed intenta volver a pending', async () => {
    const response = await request(app).patch('/api/bookings/b1').send({ version: 1, status: 'pending' });
    expect(response.status).toBe(422);
    expect(response.body.error).toBe('INVALID_TRANSITION');
  });

  it('devuelve 422 INVALID_TRANSITION si se intenta mover una reserva cancelada', async () => {
    const response = await request(app)
      .patch('/api/bookings/b3')
      .send({ version: 1, start: '2026-09-11T11:00:00.000Z', end: '2026-09-11T12:00:00.000Z' });
    expect(response.status).toBe(422);
    expect(response.body.error).toBe('INVALID_TRANSITION');
  });

  it('devuelve 409 OVERLAP al mover una reserva sobre otra activa, sin contarse a sí misma', async () => {
    const response = await request(app)
      .patch('/api/bookings/b2')
      .send({ version: 1, roomId: 'sala-norte', start: '2026-09-09T09:30:00.000Z', end: '2026-09-09T10:30:00.000Z' });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('OVERLAP');
  });

  it('permite mover y cambiar de estado en la misma petición', async () => {
    const response = await request(app).patch('/api/bookings/b2').send({
      version: 1,
      status: 'confirmed',
      start: '2026-09-10T11:00:00.000Z',
      end: '2026-09-10T12:00:00.000Z',
    });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('confirmed');
    expect(response.body.start).toBe('2026-09-10T11:00:00.000Z');
  });
});

describe('DELETE /api/bookings/:id', () => {
  it('borra la reserva y responde 204', async () => {
    const response = await request(app).delete('/api/bookings/b2').query({ version: 1 });
    expect(response.status).toBe(204);

    const getResponse = await request(app).get('/api/bookings/b2');
    expect(getResponse.status).toBe(404);
  });

  it('devuelve 409 VERSION_CONFLICT si la version no coincide', async () => {
    const response = await request(app).delete('/api/bookings/b1').query({ version: 5 });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('VERSION_CONFLICT');
  });

  it('devuelve 404 si no existe', async () => {
    const response = await request(app).delete('/api/bookings/no-existe').query({ version: 1 });
    expect(response.status).toBe(404);
  });
});
