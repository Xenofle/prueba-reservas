import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { computeAvailability } from './availability.js';
import type { Booking, Room } from './types.js';

const salaNorte: Room = {
  id: 'sala-norte',
  name: 'Sala Norte',
  openTime: '09:00',
  closeTime: '20:00',
  bufferMinutes: 15,
};

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

// Muy anterior a cualquier fecha usada en los tests, para no filtrar huecos por "ya empezado".
const farPast = DateTime.fromISO('2000-01-01T00:00:00.000Z', { zone: 'utc' });

describe('computeAvailability', () => {
  it('sala vacía: genera huecos cada 15 min desde la apertura hasta que ya no cabe la duración', () => {
    const slots = computeAvailability({
      room: salaNorte,
      date: '2026-09-09', // miércoles, invierno austral, verano en España (CEST, UTC+2)
      durationMinutes: 60,
      bookings: [],
      now: farPast,
    });

    // Apertura 09:00 local = 07:00 UTC en septiembre (CEST). Cierre 20:00 local = 18:00 UTC.
    expect(slots[0]).toEqual({ start: '2026-09-09T07:00:00.000Z', end: '2026-09-09T08:00:00.000Z' });
    const last = slots[slots.length - 1];
    expect(last).toEqual({ start: '2026-09-09T17:00:00.000Z', end: '2026-09-09T18:00:00.000Z' });
  });

  it('respeta el margen entre dos reservas existentes', () => {
    const bookings = [
      makeBooking({ id: 'b1', start: '2026-09-09T07:00:00.000Z', end: '2026-09-09T08:00:00.000Z' }),
    ];

    const slots = computeAvailability({
      room: salaNorte,
      date: '2026-09-09',
      durationMinutes: 60,
      bookings,
      now: farPast,
    });

    // Un hueco que empezara a las 08:00 invadiría el margen de 15 min; el primero libre es 08:15.
    const startsAt0800 = slots.some((slot) => slot.start === '2026-09-09T08:00:00.000Z');
    const startsAt0815 = slots.some((slot) => slot.start === '2026-09-09T08:15:00.000Z');
    expect(startsAt0800).toBe(false);
    expect(startsAt0815).toBe(true);
  });

  it('no aplica margen contra el cierre de la sala', () => {
    const slots = computeAvailability({
      room: salaNorte,
      date: '2026-09-09',
      durationMinutes: 60,
      bookings: [],
      now: farPast,
    });

    // Cierre local 20:00 = 18:00 UTC; el último hueco de 60 min debe terminar justo en el cierre.
    const last = slots[slots.length - 1];
    expect(last?.end).toBe('2026-09-09T18:00:00.000Z');
  });

  it('las reservas canceladas no ocupan hueco', () => {
    const bookings = [
      makeBooking({ id: 'b1', status: 'cancelled', start: '2026-09-09T07:00:00.000Z', end: '2026-09-09T08:00:00.000Z' }),
    ];

    const slots = computeAvailability({
      room: salaNorte,
      date: '2026-09-09',
      durationMinutes: 60,
      bookings,
      now: farPast,
    });

    expect(slots.some((slot) => slot.start === '2026-09-09T07:00:00.000Z')).toBe(true);
  });

  it('convierte correctamente la hora local a UTC en un día de invierno', () => {
    const slots = computeAvailability({
      room: salaNorte,
      date: '2026-01-14', // invierno, CET = UTC+1
      durationMinutes: 60,
      bookings: [],
      now: farPast,
    });

    expect(slots[0]).toEqual({ start: '2026-01-14T08:00:00.000Z', end: '2026-01-14T09:00:00.000Z' });
  });

  it('convierte correctamente la hora local a UTC en un día de verano', () => {
    const slots = computeAvailability({
      room: salaNorte,
      date: '2026-07-14', // verano, CEST = UTC+2
      durationMinutes: 60,
      bookings: [],
      now: farPast,
    });

    expect(slots[0]).toEqual({ start: '2026-07-14T07:00:00.000Z', end: '2026-07-14T08:00:00.000Z' });
  });

  it('no devuelve huecos que ya han empezado', () => {
    // 2026-09-09 es CEST (UTC+2): 09:30 local = 07:30 UTC.
    const now = DateTime.fromISO('2026-09-09T07:30:00.000Z', { zone: 'utc' });

    const slots = computeAvailability({
      room: salaNorte,
      date: '2026-09-09',
      durationMinutes: 60,
      bookings: [],
      now,
    });

    expect(slots.every((slot) => DateTime.fromISO(slot.start, { zone: 'utc' }) >= now)).toBe(true);
    expect(slots.some((slot) => slot.start === '2026-09-09T07:00:00.000Z')).toBe(false);
  });
});
