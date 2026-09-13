import { describe, expect, it } from 'vitest';
import { canTransition, isMovable } from './transitions.js';

describe('canTransition', () => {
  it('permite pending -> confirmed', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
  });

  it('permite pending -> cancelled', () => {
    expect(canTransition('pending', 'cancelled')).toBe(true);
  });

  it('permite confirmed -> cancelled', () => {
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
  });

  it('no permite confirmed -> pending', () => {
    expect(canTransition('confirmed', 'pending')).toBe(false);
  });

  it('no permite reactivar una cancelada', () => {
    expect(canTransition('cancelled', 'pending')).toBe(false);
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
  });

  it('no permite quedarse en el mismo estado', () => {
    expect(canTransition('pending', 'pending')).toBe(false);
    expect(canTransition('confirmed', 'confirmed')).toBe(false);
    expect(canTransition('cancelled', 'cancelled')).toBe(false);
  });
});

describe('isMovable', () => {
  it('una reserva pendiente o confirmada se puede mover', () => {
    expect(isMovable('pending')).toBe(true);
    expect(isMovable('confirmed')).toBe(true);
  });

  it('una reserva cancelada no se puede mover', () => {
    expect(isMovable('cancelled')).toBe(false);
  });
});
