import { useEffect, useState } from 'react';
import { getRooms } from './api/client';
import type { Room } from './api/types';
import { BookingsList } from './components/BookingsList';
import { Filters } from './components/Filters';
import { NewBookingDialog } from './components/NewBookingDialog';
import { useBookings } from './hooks/useBookings';
import { useUrlFilters } from './hooks/useUrlFilters';

function App() {
  const [filters, setFilters] = useUrlFilters();
  const { items, total, isLoading, isLoadingMore, error, hasMore, loadMore, reload, updateBookingStatus } =
    useBookings(filters);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getRooms(controller.signal)
      .then(setRooms)
      .catch(() => {
        // Si fallan las salas, el listado sigue funcionando; solo se
        // quedan sin nombre legible las filas (se muestra el id).
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>Panel de reservas de estudio</h1>
      <div className="toolbar">
        <button type="button" onClick={() => setIsDialogOpen(true)}>
          Nueva reserva
        </button>
      </div>
      <Filters filters={filters} rooms={rooms} onChange={setFilters} />
      <BookingsList
        items={items}
        total={total}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        error={error}
        hasMore={hasMore}
        rooms={rooms}
        onLoadMore={loadMore}
        onRetry={reload}
        onUpdateStatus={updateBookingStatus}
      />
      {isDialogOpen && (
        <NewBookingDialog
          rooms={rooms}
          onClose={() => setIsDialogOpen(false)}
          onCreated={reload}
        />
      )}
    </main>
  );
}

export default App;
