import { useEffect, useRef } from 'react';
import type { Booking, Room } from '../api/types';
import { formatLocalDateTime } from '../lib/dates';

const STATUS_LABELS: Record<Booking['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

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
          <li key={booking.id} className="booking-row">
            <div className="booking-main">
              <strong>{booking.title}</strong>
              <span>{booking.client}</span>
            </div>
            <div className="booking-meta">
              <span>{roomName(booking.roomId)}</span>
              <span>
                {formatLocalDateTime(booking.start)} – {formatLocalDateTime(booking.end)}
              </span>
              <span className={`status-badge status-badge-${booking.status}`}>
                {STATUS_LABELS[booking.status]}
              </span>
            </div>
          </li>
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
