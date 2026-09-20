import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatLocalDateTime,
  localDateTimeToUtcIso,
  utcIsoToLocalDate,
  utcIsoToLocalTime,
} from './dates';

describe('localDateTimeToUtcIso', () => {
  it('convierte correctamente un día de invierno (CET, UTC+1)', () => {
    expect(localDateTimeToUtcIso('2026-01-14', '09:00')).toBe('2026-01-14T08:00:00.000Z');
  });

  it('convierte correctamente un día de verano (CEST, UTC+2)', () => {
    expect(localDateTimeToUtcIso('2026-07-14', '09:00')).toBe('2026-07-14T07:00:00.000Z');
  });
});

describe('utcIsoToLocalDate / utcIsoToLocalTime', () => {
  it('deshace la conversión de un instante de invierno', () => {
    expect(utcIsoToLocalDate('2026-01-14T08:00:00.000Z')).toBe('2026-01-14');
    expect(utcIsoToLocalTime('2026-01-14T08:00:00.000Z')).toBe('09:00');
  });

  it('deshace la conversión de un instante de verano', () => {
    expect(utcIsoToLocalDate('2026-07-14T07:00:00.000Z')).toBe('2026-07-14');
    expect(utcIsoToLocalTime('2026-07-14T07:00:00.000Z')).toBe('09:00');
  });

  it('hace de ida y vuelta sin perder el minuto exacto', () => {
    const isoUtc = localDateTimeToUtcIso('2026-09-09', '14:37');
    expect(utcIsoToLocalDate(isoUtc)).toBe('2026-09-09');
    expect(utcIsoToLocalTime(isoUtc)).toBe('14:37');
  });
});

describe('formatLocalDateTime', () => {
  it('formatea en la zona del estudio, no en la del sistema', () => {
    expect(formatLocalDateTime('2026-01-14T08:00:00.000Z')).toBe('14/01/2026 09:00');
    expect(formatLocalDateTime('2026-07-14T07:00:00.000Z')).toBe('14/07/2026 09:00');
  });
});

describe('independencia de la zona horaria del sistema', () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/New_York';
  });

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('no cambia el resultado aunque cambie la zona horaria del ordenador', () => {
    // Aunque el "sistema" esté en America/New_York, todo se calcula sobre
    // Europe/Madrid de forma explícita: el resultado debe ser idéntico.
    expect(localDateTimeToUtcIso('2026-01-14', '09:00')).toBe('2026-01-14T08:00:00.000Z');
    expect(utcIsoToLocalTime('2026-01-14T08:00:00.000Z')).toBe('09:00');
    expect(formatLocalDateTime('2026-01-14T08:00:00.000Z')).toBe('14/01/2026 09:00');
  });
});
