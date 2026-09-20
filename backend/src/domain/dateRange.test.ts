import { describe, expect, it } from 'vitest';
import { overlapsRange, resolveListingRange } from './dateRange.js';

describe('resolveListingRange', () => {
  it('interpreta "from" de solo fecha como el inicio del día local del estudio', () => {
    const bounds = resolveListingRange({ from: '2026-09-09' });
    // 00:00 del 9 de septiembre en Europe/Madrid (CEST, UTC+2) = 22:00 UTC del día 8.
    expect(bounds?.fromUtc?.toISO()).toBe('2026-09-08T22:00:00.000Z');
  });

  it('interpreta "to" de solo fecha como el final (incluido) del día local del estudio', () => {
    const bounds = resolveListingRange({ to: '2026-09-09' });
    // 23:59:59.999 del 9 de septiembre en Europe/Madrid = 21:59:59.999 UTC del mismo día.
    expect(bounds?.toUtc?.toISO()).toBe('2026-09-09T21:59:59.999Z');
  });

  it('acepta un instante ISO completo tal cual, en UTC', () => {
    const bounds = resolveListingRange({ from: '2026-09-09T10:30:00.000Z' });
    expect(bounds?.fromUtc?.toISO()).toBe('2026-09-09T10:30:00.000Z');
  });

  it('devuelve null si el formato no es reconocible', () => {
    expect(resolveListingRange({ from: 'no-es-una-fecha' })).toBeNull();
  });

  it('devuelve null si "from" es posterior a "to"', () => {
    expect(resolveListingRange({ from: '2026-09-10', to: '2026-09-09' })).toBeNull();
  });

  it('devuelve límites vacíos cuando no se pide ni from ni to', () => {
    expect(resolveListingRange({})).toEqual({});
  });
});

describe('overlapsRange', () => {
  const bounds = resolveListingRange({ from: '2026-09-09', to: '2026-09-09' });
  if (!bounds) throw new Error('rango de prueba inválido');

  it('incluye una reserva que empieza dentro del día', () => {
    expect(overlapsRange('2026-09-09T10:00:00.000Z', '2026-09-09T11:00:00.000Z', bounds)).toBe(true);
  });

  it('incluye una reserva que solo se solapa parcialmente por el borde de apertura del rango', () => {
    expect(overlapsRange('2026-09-08T21:00:00.000Z', '2026-09-08T23:00:00.000Z', bounds)).toBe(true);
  });

  it('excluye una reserva completamente anterior al rango', () => {
    expect(overlapsRange('2026-09-08T10:00:00.000Z', '2026-09-08T11:00:00.000Z', bounds)).toBe(false);
  });

  it('excluye una reserva completamente posterior al rango', () => {
    expect(overlapsRange('2026-09-10T10:00:00.000Z', '2026-09-10T11:00:00.000Z', bounds)).toBe(false);
  });
});
