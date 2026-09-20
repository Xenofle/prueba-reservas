import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./api/client', async () => {
  const actual = await vi.importActual<typeof import('./api/client')>('./api/client');
  return {
    ...actual,
    getRooms: vi.fn().mockResolvedValue([]),
    listBookings: vi.fn().mockResolvedValue({ items: [], nextCursor: null, total: 0 }),
  };
});

describe('App', () => {
  it('muestra el título del panel y, tras cargar, el listado (aquí, vacío)', async () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Panel de reservas de estudio' }),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText('No hay reservas que coincidan con estos filtros.')).toBeInTheDocument(),
    );
  });
});
