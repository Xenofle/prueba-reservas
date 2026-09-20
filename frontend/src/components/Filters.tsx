import { useEffect, useState } from 'react';
import type { Room } from '../api/types';
import { useDebounce } from '../hooks/useDebounce';
import type { BookingFilters, SetBookingFilters } from '../hooks/useUrlFilters';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'cancelled', label: 'Cancelada' },
];

const SEARCH_DEBOUNCE_MS = 300;

type FiltersProps = {
  filters: BookingFilters;
  rooms: Room[];
  onChange: SetBookingFilters;
};

export function Filters({ filters, rooms, onChange }: FiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.q ?? '');
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);

  // Si el filtro cambia desde fuera (atrás/adelante del navegador), el
  // cuadro de búsqueda debe reflejarlo, no quedarse con lo último tecleado.
  useEffect(() => {
    setSearchInput(filters.q ?? '');
  }, [filters.q]);

  // Solo se pide al servidor (vía la URL) 300ms después de la última tecla.
  useEffect(() => {
    if (debouncedSearch !== (filters.q ?? '')) {
      onChange({ q: debouncedSearch });
    }
    // Deliberadamente no depende de `filters.q`/`onChange`: solo debe
    // disparar cuando cambia el valor debounced, no cuando la URL cambia.
  }, [debouncedSearch]);

  return (
    <form className="filters" onSubmit={(event) => event.preventDefault()}>
      <label className="filters-field">
        <span>Buscar</span>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Título o cliente…"
        />
      </label>

      <label className="filters-field">
        <span>Sala</span>
        <select value={filters.roomId ?? ''} onChange={(event) => onChange({ roomId: event.target.value })}>
          <option value="">Todas las salas</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </label>

      <label className="filters-field">
        <span>Estado</span>
        <select value={filters.status ?? ''} onChange={(event) => onChange({ status: event.target.value })}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filters-field">
        <span>Desde</span>
        <input type="date" value={filters.from ?? ''} onChange={(event) => onChange({ from: event.target.value })} />
      </label>

      <label className="filters-field">
        <span>Hasta</span>
        <input type="date" value={filters.to ?? ''} onChange={(event) => onChange({ to: event.target.value })} />
      </label>
    </form>
  );
}
