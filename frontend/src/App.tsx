import { useEffect, useState } from 'react';
import { getRooms } from './api/client';
import type { Room } from './api/types';
import { BookingsList } from './components/BookingsList';
import { Filters } from './components/Filters';
import { useBookings } from './hooks/useBookings';
import { useUrlFilters } from './hooks/useUrlFilters';

function App() {
  const [filters, setFilters] = useUrlFilters();
  const { items, total, isLoading, isLoadingMore, error, hasMore, loadMore, reload, updateBookingStatus } =
    useBookings(filters);

  const [rooms, setRooms] = useState<Room[]>([]);

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
    </main>
  );
}

export default App;
