import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './useDebounce';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebounce', () => {
  it('mantiene el valor inicial antes de que pase el retraso', () => {
    const { result } = renderHook(() => useDebounce('a', 300));
    expect(result.current).toBe('a');
  });

  it('propaga el valor nuevo solo cuando pasan 300ms sin más cambios', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab');
  });

  it('cada tecla reinicia el temporizador: no se propaga ningún valor intermedio', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'al' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'alv' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'alva' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Han pasado 600ms en total, pero nunca 300ms seguidos sin teclear.
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('alva');
  });
});
