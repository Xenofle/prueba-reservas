import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type { Booking, BookingStatus, Room } from '../api/types';
import { formatLocalDateTime } from '../lib/dates';

const STATUS_LABELS: Record<Booking['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

const ACTION_LABELS: Record<'confirmed' | 'cancelled', string> = {
  confirmed: 'Confirmar',
  cancelled: 'Cancelar',
};

// Espeja las transiciones permitidas en el backend (pending -> confirmed o
// cancelled; confirmed -> solo cancelled; cancelled no se reactiva ni se
// mueve). Es solo para no ofrecer botones que el servidor rechazaría: la
// validación real sigue viviendo ahí, esto es una ayuda de la interfaz.
function availableActions(status: BookingStatus): Array<'confirmed' | 'cancelled'> {
  if (status === 'pending') return ['confirmed', 'cancelled'];
  if (status === 'confirmed') return ['cancelled'];
  return [];
}

function describeUpdateError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
    return 'Esta reserva cambió mientras tanto: se han cargado los datos más recientes del servidor.';
  }
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'No se pudo actualizar la reserva.';
}

type BookingRowProps = {
  booking: Booking;
  roomName: string;
  onUpdateStatus: (booking: Booking, status: BookingStatus) => Promise<void>;
};

function BookingRow({ booking, roomName, onUpdateStatus }: BookingRowProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleAction(status: 'confirmed' | 'cancelled'): Promise<void> {
    setNotice(null);
    setIsSubmitting(true);
    try {
      await onUpdateStatus(booking, status);
    } catch (err) {
      setNotice(describeUpdateError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <li className="booking-row">
      <div className="booking-main">
        <strong>{booking.title}</strong>
        <span>{booking.client}</span>
      </div>
      <div className="booking-meta">
        <span>{roomName}</span>
        <span>
          {formatLocalDateTime(booking.start)} – {formatLocalDateTime(booking.end)}
        </span>
        <span className={`status-badge status-badge-${booking.status}`}>
          {STATUS_LABELS[booking.status]}
        </span>
      </div>
      <div className="booking-actions">
        {availableActions(booking.status).map((action) => (
          <button
            key={action}
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              void handleAction(action);
            }}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>
      {notice && (
        <p className="booking-notice" role="alert">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </p>
      )}
    </li>
  );
}

type BookingsListProps = {
  items: Booking[];
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  rooms: Room[];
  onLoadMore: () => void;
  onRetry: () => void;
  onUpdateStatus: (booking: Booking, status: BookingStatus) => Promise<void>;
};

export function BookingsList({
  items,
  total,
  isLoading,
  isLoadingMore,
  error,
  hasMore,
  rooms,
  onLoadMore,
  onRetry,
  onUpdateStatus,
}: BookingsListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Scroll infinito: cuando el centinela del final de la lista entra en
  // pantalla se pide la siguiente página. loadMore() ya se protege sola
  // contra llamadas duplicadas mientras hay una petición en curso.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onLoadMore();
      }
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, items.length]);

  function roomName(roomId: string): string {
    return rooms.find((room) => room.id === roomId)?.name ?? roomId;
  }

  if (isLoading) {
    return (
      <p className="state state-loading" role="status">
        Cargando reservas…
      </p>
    );
  }

  if (error) {
    return (
      <div className="state state-error" role="alert">
        <p>No se pudieron cargar las reservas: {error.message}</p>
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="state state-empty">No hay reservas que coincidan con estos filtros.</p>;
  }

  return (
    <>
      <p className="bookings-total">
        {total} reserva{total === 1 ? '' : 's'}
      </p>
      <ul className="bookings-list">
        {items.map((booking) => (
          <BookingRow
            key={booking.id}
            booking={booking}
            roomName={roomName(booking.roomId)}
            onUpdateStatus={onUpdateStatus}
          />
        ))}
      </ul>
      {isLoadingMore && (
        <p className="state state-loading-more" role="status">
          Cargando más…
        </p>
      )}
      <div ref={sentinelRef} aria-hidden="true" />
    </>
  );
}
