import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUrlFilters } from './useUrlFilters';

function setLocation(search: string): void {
  window.history.pushState(null, '', `/${search}`);
}

describe('useUrlFilters', () => {
  beforeEach(() => {
    setLocation('');
  });

  it('lee los filtros iniciales de la URL', () => {
    setLocation('?q=alvaro&roomId=sala-norte&status=confirmed');

    const { result } = renderHook(() => useUrlFilters());

    expect(result.current[0]).toEqual({ q: 'alvaro', roomId: 'sala-norte', status: 'confirmed' });
  });

  it('sin query string, no hay filtros', () => {
    const { result } = renderHook(() => useUrlFilters());
    expect(result.current[0]).toEqual({});
  });

  it('cambiar un filtro actualiza el estado y hace pushState en la URL', () => {
    const { result } = renderHook(() => useUrlFilters());

    act(() => {
      result.current[1]({ roomId: 'sala-sur' });
    });

    expect(result.current[0]).toEqual({ roomId: 'sala-sur' });
    expect(window.location.search).toBe('?roomId=sala-sur');
  });

  it('los filtros son combinables: añadir uno conserva los demás', () => {
    const { result } = renderHook(() => useUrlFilters());

    act(() => {
      result.current[1]({ roomId: 'sala-sur' });
    });
    act(() => {
      result.current[1]({ status: 'pending' });
    });

    expect(result.current[0]).toEqual({ roomId: 'sala-sur', status: 'pending' });
  });

  it('poner un filtro a cadena vacía lo quita de la URL', () => {
    setLocation('?q=hola&roomId=sala-norte');
    const { result } = renderHook(() => useUrlFilters());

    act(() => {
      result.current[1]({ q: '' });
    });

    expect(result.current[0]).toEqual({ roomId: 'sala-norte' });
    expect(window.location.search).toBe('?roomId=sala-norte');
  });

  it('recargar (montar de nuevo) mantiene la vista desde la URL actual', () => {
    setLocation('?status=pending');

    const first = renderHook(() => useUrlFilters());
    expect(first.result.current[0]).toEqual({ status: 'pending' });
    first.unmount();

    const second = renderHook(() => useUrlFilters());
    expect(second.result.current[0]).toEqual({ status: 'pending' });
  });

  it('un popstate (atrás/adelante) sincroniza el estado con la URL, no con el anterior', () => {
    const { result } = renderHook(() => useUrlFilters());

    act(() => {
      result.current[1]({ roomId: 'sala-norte' });
    });
    expect(result.current[0]).toEqual({ roomId: 'sala-norte' });

    act(() => {
      setLocation('?status=cancelled');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current[0]).toEqual({ status: 'cancelled' });
  });
});
