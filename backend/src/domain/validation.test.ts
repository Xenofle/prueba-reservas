import { describe, expect, it } from 'vitest';
import { validateBookingInput, type BookingInput } from './validation.js';

function makeInput(overrides: Partial<BookingInput> = {}): BookingInput {
  return {
    title: 'Ensayo banda',
    client: 'Álvaro García',
    start: '2026-09-09T09:00:00.000Z',
    end: '2026-09-09T10:00:00.000Z',
    ...overrides,
  };
}

describe('validateBookingInput', () => {
  it('acepta una entrada válida', () => {
    expect(validateBookingInput(makeInput())).toBeNull();
  });

  it('rechaza un título demasiado corto', () => {
    const error = validateBookingInput(makeInput({ title: 'ab' }));
    expect(error).toEqual({ field: 'title', message: expect.any(String) });
  });

  it('rechaza un título demasiado largo', () => {
    const error = validateBookingInput(makeInput({ title: 'a'.repeat(81) }));
    expect(error?.field).toBe('title');
  });

  it('rechaza un cliente demasiado corto', () => {
    const error = validateBookingInput(makeInput({ client: 'a' }));
    expect(error?.field).toBe('client');
  });

  it('acepta los límites exactos de longitud (3 y 80)', () => {
    expect(validateBookingInput(makeInput({ title: 'abc', client: 'a'.repeat(80) }))).toBeNull();
  });

  it('rechaza una fecha de inicio no ISO', () => {
    const error = validateBookingInput(makeInput({ start: 'no-es-una-fecha' }));
    expect(error?.field).toBe('start');
  });

  it('rechaza una fecha de fin no ISO', () => {
    const error = validateBookingInput(makeInput({ end: 'no-es-una-fecha' }));
    expect(error?.field).toBe('end');
  });

  it('rechaza end anterior o igual a start', () => {
    const before = validateBookingInput(
      makeInput({ start: '2026-09-09T10:00:00.000Z', end: '2026-09-09T09:00:00.000Z' }),
    );
    expect(before?.field).toBe('end');

    const equal = validateBookingInput(
      makeInput({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T09:00:00.000Z' }),
    );
    expect(equal?.field).toBe('end');
  });

  it('rechaza una duración que no es múltiplo de 15 minutos', () => {
    const error = validateBookingInput(
      makeInput({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T09:40:00.000Z' }),
    );
    expect(error?.field).toBe('end');
  });

  it('rechaza una duración menor de 30 minutos', () => {
    const error = validateBookingInput(
      makeInput({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T09:15:00.000Z' }),
    );
    expect(error?.field).toBe('end');
  });

  it('rechaza una duración mayor de 480 minutos', () => {
    const error = validateBookingInput(
      makeInput({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T17:15:00.000Z' }),
    );
    expect(error?.field).toBe('end');
  });

  it('acepta los límites exactos de duración (30 y 480 minutos)', () => {
    expect(
      validateBookingInput(makeInput({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T09:30:00.000Z' })),
    ).toBeNull();

    expect(
      validateBookingInput(makeInput({ start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T17:00:00.000Z' })),
    ).toBeNull();
  });
});
