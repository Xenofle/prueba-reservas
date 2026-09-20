import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError, createBooking } from '../api/client';
import type { Room, Slot } from '../api/types';
import { useAvailability } from '../hooks/useAvailability';
import { todayLocalDate, utcIsoToLocalTime } from '../lib/dates';

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 180, 240];
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type NewBookingDialogProps = {
  rooms: Room[];
  onClose: () => void;
  onCreated: () => void;
};

function describeSubmitError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'No se pudo crear la reserva.';
}

export function NewBookingDialog({ rooms, onClose, onCreated }: NewBookingDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);

  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [date, setDate] = useState(() => todayLocalDate());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [selectedSlotStart, setSelectedSlotStart] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!roomId && rooms.length > 0) {
      const first = rooms[0];
      if (first) setRoomId(first.id);
    }
  }, [rooms, roomId]);

  const availabilityParams = roomId && date && durationMinutes > 0 ? { roomId, date, durationMinutes } : null;
  const { slots, isLoading: isLoadingSlots, error: availabilityError, reload } = useAvailability(availabilityParams);

  // Cambiar cualquiera de los tres campos invalida el hueco elegido: la
  // lista se recarga sola (useAvailability ya cancela la petición anterior).
  useEffect(() => {
    setSelectedSlotStart('');
  }, [roomId, date, durationMinutes]);

  // Foco al abrir, y de vuelta al botón que abrió el diálogo al cerrarlo.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();

    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const container = dialogRef.current;
    if (!container) return;

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const selectedSlot = slots.find((slot) => slot.start === selectedSlotStart);
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createBooking({ roomId, title, client, start: selectedSlot.start, end: selectedSlot.end });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OVERLAP') {
        setSubmitError('Ese hueco ya se ha ocupado. Se han recargado los huecos disponibles.');
        setSelectedSlotStart('');
        reload();
      } else {
        setSubmitError(describeSubmitError(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function slotLabel(slot: Slot): string {
    return `${utcIsoToLocalTime(slot.start)}–${utcIsoToLocalTime(slot.end)}`;
  }

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-booking-title"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <h2 id="new-booking-title">Nueva reserva</h2>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label className="filters-field">
            <span>Sala</span>
            <select
              ref={firstFieldRef}
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              required
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>

          <label className="filters-field">
            <span>Día</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>

          <label className="filters-field">
            <span>Duración</span>
            <select
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              required
            >
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </label>

          <label className="filters-field">
            <span>Hueco</span>
            <select
              value={selectedSlotStart}
              onChange={(event) => setSelectedSlotStart(event.target.value)}
              disabled={isLoadingSlots || slots.length === 0}
              required
            >
              <option value="" disabled>
                {isLoadingSlots
                  ? 'Cargando huecos…'
                  : slots.length === 0
                    ? 'No hay huecos disponibles'
                    : 'Elige un hueco'}
              </option>
              {slots.map((slot) => (
                <option key={slot.start} value={slot.start}>
                  {slotLabel(slot)}
                </option>
              ))}
            </select>
          </label>

          {availabilityError && (
            <p role="alert" className="dialog-error">
              No se pudieron cargar los huecos: {availabilityError.message}
            </p>
          )}

          <label className="filters-field">
            <span>Título</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={3}
              maxLength={80}
              required
            />
          </label>

          <label className="filters-field">
            <span>Cliente</span>
            <input
              type="text"
              value={client}
              onChange={(event) => setClient(event.target.value)}
              minLength={3}
              maxLength={80}
              required
            />
          </label>

          {submitError && (
            <p role="alert" className="dialog-error">
              {submitError}
            </p>
          )}

          <div className="dialog-actions">
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting || !selectedSlotStart}>
              Crear reserva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
