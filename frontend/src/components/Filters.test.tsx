import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '../api/types';
import type { BookingFilters } from '../hooks/useUrlFilters';
import { Filters } from './Filters';

const rooms: Room[] = [
  { id: 'sala-norte', name: 'Sala Norte', openTime: '09:00', closeTime: '20:00', bufferMinutes: 15 },
  { id: 'sala-sur', name: 'Sala Sur', openTime: '10:00', closeTime: '22:00', bufferMinutes: 30 },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderFilters(filters: BookingFilters = {}) {
  const onChange = vi.fn();
  const utils = render(<Filters filters={filters} rooms={rooms} onChange={onChange} />);
  return { onChange, ...utils };
}

describe('Filters', () => {
  it('lista las salas recibidas por props', () => {
    renderFilters();
    expect(screen.getByRole('option', { name: 'Sala Norte' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sala Sur' })).toBeInTheDocument();
  });

  it('la búsqueda se manda 300ms después de la última tecla, no en cada una', () => {
    const { onChange } = renderFilters();
    const input = screen.getByPlaceholderText('Título o cliente…');

    fireEvent.change(input, { target: { value: 'al' } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.change(input, { target: { value: 'alvaro' } });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Han pasado 400ms en total, pero nunca 300ms seguidos sin teclear.
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ q: 'alvaro' });
  });

  it('cambiar la sala llama a onChange de inmediato, sin debounce', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onChange } = renderFilters();

    await user.selectOptions(screen.getByLabelText('Sala'), 'sala-sur');

    expect(onChange).toHaveBeenCalledWith({ roomId: 'sala-sur' });
  });

  it('cambiar el estado llama a onChange de inmediato', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onChange } = renderFilters();

    await user.selectOptions(screen.getByLabelText('Estado'), 'confirmed');

    expect(onChange).toHaveBeenCalledWith({ status: 'confirmed' });
  });

  it('si el filtro q cambia desde fuera, el cuadro de búsqueda lo refleja', () => {
    const { rerender } = renderFilters({ q: 'inicial' });
    expect(screen.getByPlaceholderText('Título o cliente…')).toHaveValue('inicial');

    rerender(<Filters filters={{ q: 'otro' }} rooms={rooms} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Título o cliente…')).toHaveValue('otro');
  });
});
