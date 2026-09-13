import { describe, expect, it } from 'vitest';
import { findOverlaps } from './overlap.js';
import type { Booking } from './types.js';

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

describe('findOverlaps', () => {
  it('detecta solape directo al crear una reserva', () => {
    const existing = [
      makeBooking({ id: 'b1', start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }),
    ];

    const conflicts = findOverlaps(
      { start: '2026-09-09T09:30:00.000Z', end: '2026-09-09T10:30:00.000Z' },
      'sala-norte',
      15,
      existing,
    );

    expect(conflicts).toEqual(['b1']);
  });

  it('detecta invasión del margen aunque los intervalos no se solapen', () => {
    const existing = [
      makeBooking({ id: 'b1', start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }),
    ];

    // Empieza justo cuando termina b1, sin dejar los 15 min de margen.
    const conflicts = findOverlaps(
      { start: '2026-09-09T10:00:00.000Z', end: '2026-09-09T11:00:00.000Z' },
      'sala-norte',
      15,
      existing,
    );

    expect(conflicts).toEqual(['b1']);
  });

  it('permite una reserva que respeta el margen exacto', () => {
    const existing = [
      makeBooking({ id: 'b1', start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }),
    ];

    const conflicts = findOverlaps(
      { start: '2026-09-09T10:15:00.000Z', end: '2026-09-09T11:15:00.000Z' },
      'sala-norte',
      15,
      existing,
    );

    expect(conflicts).toEqual([]);
  });

  it('ignora reservas canceladas', () => {
    const existing = [
      makeBooking({ id: 'b1', status: 'cancelled', start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }),
    ];

    const conflicts = findOverlaps(
      { start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' },
      'sala-norte',
      15,
      existing,
    );

    expect(conflicts).toEqual([]);
  });

  it('ignora reservas de otra sala', () => {
    const existing = [
      makeBooking({ id: 'b1', roomId: 'sala-sur', start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }),
    ];

    const conflicts = findOverlaps(
      { start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' },
      'sala-norte',
      15,
      existing,
    );

    expect(conflicts).toEqual([]);
  });

  it('no cuenta la propia reserva al moverla', () => {
    const existing = [
      makeBooking({ id: 'b1', start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' }),
    ];

    const conflicts = findOverlaps(
      { start: '2026-09-09T09:15:00.000Z', end: '2026-09-09T10:15:00.000Z' },
      'sala-norte',
      15,
      existing,
      'b1',
    );

    expect(conflicts).toEqual([]);
  });
});
