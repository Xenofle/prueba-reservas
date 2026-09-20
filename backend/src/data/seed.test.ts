import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { findOverlaps } from '../domain/overlap.js';
import { buildSeedData } from './seed.js';

const anchor = DateTime.fromISO('2026-09-09T12:00:00.000Z', { zone: 'utc' });

describe('buildSeedData', () => {
  it('genera las 3 salas del enunciado', () => {
    const { rooms } = buildSeedData(anchor);
    expect(rooms.map((room) => room.id).sort()).toEqual(['cabina-voz', 'sala-norte', 'sala-sur']);
  });

  it('genera alrededor de 100 reservas', () => {
    const { bookings } = buildSeedData(anchor);
    expect(bookings.length).toBe(100);
  });

  it('es determinista: la misma ancla produce exactamente los mismos datos', () => {
    const first = buildSeedData(anchor);
    const second = buildSeedData(anchor);
    expect(second).toEqual(first);
  });

  it('mezcla los tres estados', () => {
    const { bookings } = buildSeedData(anchor);
    const statuses = new Set(bookings.map((booking) => booking.status));
    expect(statuses).toEqual(new Set(['pending', 'confirmed', 'cancelled']));
  });

  it('no genera solapes entre reservas activas de una misma sala', () => {
    const { rooms, bookings } = buildSeedData(anchor);

    for (const room of rooms) {
      const roomBookings = bookings.filter((booking) => booking.roomId === room.id);
      const activeBookings = roomBookings.filter((booking) => booking.status !== 'cancelled');
      for (const booking of activeBookings) {
        const conflicts = findOverlaps(
          booking,
          room.id,
          room.bufferMinutes,
          activeBookings,
          booking.id,
        );
        expect(conflicts).toEqual([]);
      }
    }
  });
});
