import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { AvailabilityResponse, Booking, Room } from '../api/types';
import { NewBookingDialog } from './NewBookingDialog';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    getAvailability: vi.fn(),
    createBooking: vi.fn(),
  };
});

const { getAvailability, createBooking } = await import('../api/client');
const getAvailabilityMock = vi.mocked(getAvailability);
const createBookingMock = vi.mocked(createBooking);

const rooms: Room[] = [
  { id: 'sala-norte', name: 'Sala Norte', openTime: '09:00', closeTime: '20:00', bufferMinutes: 15 },
  { id: 'sala-sur', name: 'Sala Sur', openTime: '10:00', closeTime: '22:00', bufferMinutes: 30 },
];

function availabilityResponse(overrides: Partial<AvailabilityResponse> = {}): AvailabilityResponse {
  return {
    roomId: 'sala-norte',
    date: '2026-09-09',
    durationMinutes: 60,
    timeZone: 'Europe/Madrid',
    slots: [
      { start: '2026-09-09T09:00:00.000Z', end: '2026-09-09T10:00:00.000Z' },
      { start: '2026-09-09T10:00:00.000Z', end: '2026-09-09T11:00:00.000Z' },
    ],
    ...overrides,
  };
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    roomId: 'sala-norte',
    title: 'Ensayo',
    client: 'Cliente',
    start: '2026-09-09T09:00:00.000Z',
    end: '2026-09-09T10:00:00.000Z',
    status: 'pending',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function OpenerHarness({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Nueva reserva
      </button>
      {open && <NewBookingDialog rooms={rooms} onClose={() => setOpen(false)} onCreated={onCreated} />}
    </div>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('NewBookingDialog: accesibilidad', () => {
  it('al abrir, el foco entra en el diálogo (el primer campo, Sala)', async () => {
    getAvailabilityMock.mockResolvedValue(availabilityResponse());
    render(<NewBookingDialog rooms={rooms} onClose={vi.fn()} onCreated={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Sala')).toHaveFocus());
  });

  it('Escape cierra el diálogo', async () => {
    getAvailabilityMock.mockResolvedValue(availabilityResponse());
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NewBookingDialog rooms={rooms} onClose={onClose} onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Sala')).toHaveFocus());

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('el tabulador no se escapa del diálogo (focus trap)', async () => {
    getAvailabilityMock.mockResolvedValue(availabilityResponse({ slots: [] }));
    const user = userEvent.setup();
    render(<NewBookingDialog rooms={rooms} onClose={vi.fn()} onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Sala')).toHaveFocus());

    // Sin hueco elegido, "Crear reserva" está deshabilitado: el último
    // control real es "Cancelar". Shift+Tab desde el primero debe ir a él.
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    // Y Tab desde el último vuelve al primero, sin salir del diálogo.
    await user.keyboard('{Tab}');
    expect(screen.getByLabelText('Sala')).toHaveFocus();
  });

  it('al cerrar, el foco vuelve al botón que abrió el diálogo', async () => {
    getAvailabilityMock.mockResolvedValue(availabilityResponse());
    const user = userEvent.setup();
    render(<OpenerHarness onCreated={vi.fn()} />);

    const openButton = screen.getByRole('button', { name: 'Nueva reserva' });
    await user.click(openButton);
    await waitFor(() => expect(screen.getByLabelText('Sala')).toHaveFocus());

    await user.keyboard('{Escape}');

    await waitFor(() => expect(openButton).toHaveFocus());
  });
});

describe('NewBookingDialog: huecos y creación', () => {
  it('pide los huecos de la sala, día y duración por defecto al abrir', async () => {
    getAvailabilityMock.mockResolvedValue(availabilityResponse());
    render(<NewBookingDialog rooms={rooms} onClose={vi.fn()} onCreated={vi.fn()} />);

    await waitFor(() => expect(getAvailabilityMock).toHaveBeenCalledTimes(1));
    expect(getAvailabilityMock).toHaveBeenCalledWith(
      'sala-norte',
      expect.objectContaining({ durationMinutes: 60 }),
      expect.anything(),
    );
  });

  it('cambiar sala vuelve a pedir los huecos', async () => {
    getAvailabilityMock.mockResolvedValue(availabilityResponse());
    const user = userEvent.setup();
    render(<NewBookingDialog rooms={rooms} onClose={vi.fn()} onCreated={vi.fn()} />);
    await waitFor(() => expect(getAvailabilityMock).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByLabelText('Sala'), 'sala-sur');

    await waitFor(() => expect(getAvailabilityMock).toHaveBeenCalledTimes(2));
    expect(getAvailabilityMock).toHaveBeenLastCalledWith('sala-sur', expect.anything(), expect.anything());
  });

  it('crea la reserva con el hueco elegido y avisa al listado', async () => {
    getAvailabilityMock.mockResolvedValue(availabilityResponse());
    createBookingMock.mockResolvedValue(makeBooking());
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<NewBookingDialog rooms={rooms} onClose={onClose} onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByLabelText('Sala')).not.toBeDisabled());

    await user.selectOptions(screen.getByLabelText('Hueco'), '2026-09-09T09:00:00.000Z');
    await user.type(screen.getByLabelText('Título'), 'Ensayo de banda');
    await user.type(screen.getByLabelText('Cliente'), 'Álvaro García');
    await user.click(screen.getByRole('button', { name: 'Crear reserva' }));

    await waitFor(() => expect(createBookingMock).toHaveBeenCalledTimes(1));
    expect(createBookingMock).toHaveBeenCalledWith({
      roomId: 'sala-norte',
      title: 'Ensayo de banda',
      client: 'Álvaro García',
      start: '2026-09-09T09:00:00.000Z',
      end: '2026-09-09T10:00:00.000Z',
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ante un 409 OVERLAP al enviar, avisa y recarga los huecos', async () => {
    getAvailabilityMock.mockResolvedValue(availabilityResponse());
    createBookingMock.mockRejectedValue(
      new ApiError(409, { error: 'OVERLAP', message: 'La sala ya está ocupada en ese tramo.' }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NewBookingDialog rooms={rooms} onClose={onClose} onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Sala')).not.toBeDisabled());

    await user.selectOptions(screen.getByLabelText('Hueco'), '2026-09-09T09:00:00.000Z');
    await user.type(screen.getByLabelText('Título'), 'Ensayo de banda');
    await user.type(screen.getByLabelText('Cliente'), 'Álvaro García');

    expect(getAvailabilityMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Crear reserva' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ese hueco ya se ha ocupado');
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(getAvailabilityMock).toHaveBeenCalledTimes(2));
  });

  it('ante otro error de negocio, muestra el mensaje sin recargar los huecos', async () => {
    getAvailabilityMock.mockResolvedValue(availabilityResponse());
    createBookingMock.mockRejectedValue(
      new ApiError(422, { error: 'VALIDATION_ERROR', message: 'El título es obligatorio.' }),
    );
    const user = userEvent.setup();
    render(<NewBookingDialog rooms={rooms} onClose={vi.fn()} onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Sala')).not.toBeDisabled());

    await user.selectOptions(screen.getByLabelText('Hueco'), '2026-09-09T09:00:00.000Z');
    await user.type(screen.getByLabelText('Título'), 'Ensayo de banda');
    await user.type(screen.getByLabelText('Cliente'), 'Álvaro García');

    await user.click(screen.getByRole('button', { name: 'Crear reserva' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El título es obligatorio.');
    expect(getAvailabilityMock).toHaveBeenCalledTimes(1);
  });
});
