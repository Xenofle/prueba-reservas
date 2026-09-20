import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Booking, Room } from '../api/types';
import { BookingsList } from './BookingsList';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  trigger(isIntersecting: boolean): void {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const rooms: Room[] = [
  { id: 'sala-norte', name: 'Sala Norte', openTime: '09:00', closeTime: '20:00', bufferMinutes: 15 },
];

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    roomId: 'sala-norte',
    title: 'Ensayo de banda',
    client: 'Álvaro García',
    start: '2026-09-09T09:00:00.000Z',
    end: '2026-09-09T10:00:00.000Z',
    status: 'pending',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function baseProps() {
  return {
    items: [] as Booking[],
    total: 0,
    isLoading: false,
    isLoadingMore: false,
    error: null as Error | null,
    hasMore: false,
    rooms,
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
  };
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BookingsList: los cuatro estados', () => {
  it('carga inicial: muestra "Cargando reservas…" y nada más', () => {
    render(<BookingsList {...baseProps()} isLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando reservas…');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('listado vacío: avisa de que no hay reservas para esos filtros', () => {
    render(<BookingsList {...baseProps()} />);
    expect(screen.getByText('No hay reservas que coincidan con estos filtros.')).toBeInTheDocument();
  });

  it('error: muestra el mensaje y un botón para reintentar', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<BookingsList {...baseProps()} error={new Error('fallo de red')} onRetry={onRetry} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('fallo de red');

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('con reservas: las pinta y no muestra "cargando más" si no toca', () => {
    render(<BookingsList {...baseProps()} items={[makeBooking()]} total={1} />);
    expect(screen.getByText('Ensayo de banda')).toBeInTheDocument();
    expect(screen.getByText('Álvaro García')).toBeInTheDocument();
    expect(screen.getByText('Sala Norte')).toBeInTheDocument();
    expect(screen.queryByText('Cargando más…')).not.toBeInTheDocument();
  });

  it('cargando más: se ve junto a las filas ya cargadas, no las reemplaza', () => {
    render(<BookingsList {...baseProps()} items={[makeBooking()]} total={2} isLoadingMore hasMore />);
    expect(screen.getByText('Ensayo de banda')).toBeInTheDocument();
    expect(screen.getByText('Cargando más…')).toBeInTheDocument();
  });
});

describe('BookingsList: scroll infinito', () => {
  it('pide la siguiente página cuando el centinela entra en pantalla', () => {
    const onLoadMore = vi.fn();
    render(<BookingsList {...baseProps()} items={[makeBooking()]} total={2} hasMore onLoadMore={onLoadMore} />);

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    MockIntersectionObserver.instances[0]?.trigger(true);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('no observa nada si ya no hay más páginas', () => {
    render(<BookingsList {...baseProps()} items={[makeBooking()]} total={1} hasMore={false} />);
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });
});
