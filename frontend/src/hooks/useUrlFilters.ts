import { useCallback, useEffect, useState } from 'react';

export type BookingFilters = {
  q?: string;
  roomId?: string;
  status?: string;
  from?: string;
  to?: string;
};

const FILTER_KEYS = ['q', 'roomId', 'status', 'from', 'to'] as const;

// exactOptionalPropertyTypes prohíbe asignar `undefined` a una propiedad
// opcional; esta ayuda omite la clave entera en vez de vaciarla.
function withDefined<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) {
    obj[key] = value;
  }
}

function readFiltersFromLocation(): BookingFilters {
  const params = new URLSearchParams(window.location.search);
  const filters: BookingFilters = {};
  for (const key of FILTER_KEYS) {
    withDefined(filters, key, params.get(key) ?? undefined);
  }
  return filters;
}

// Un filtro vacío ('' o undefined) se trata como "sin filtro": no aparece
// en la URL.
function normalizeFilters(filters: BookingFilters): BookingFilters {
  const normalized: BookingFilters = {};
  for (const key of FILTER_KEYS) {
    withDefined(normalized, key, filters[key] || undefined);
  }
  return normalized;
}

function filtersToSearch(filters: BookingFilters): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export type SetBookingFilters = (updates: Partial<BookingFilters>) => void;

// Los filtros viven en la URL (URLSearchParams + history.pushState), así
// que recargar mantiene la vista y no hace falta un store aparte para ellos.
export function useUrlFilters(): [BookingFilters, SetBookingFilters] {
  const [filters, setFiltersState] = useState<BookingFilters>(() => readFiltersFromLocation());

  useEffect(() => {
    function handlePopState(): void {
      setFiltersState(readFiltersFromLocation());
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setFilters = useCallback<SetBookingFilters>((updates) => {
    setFiltersState((previous) => {
      const next = normalizeFilters({ ...previous, ...updates });
      const url = `${window.location.pathname}${filtersToSearch(next)}${window.location.hash}`;
      window.history.pushState(null, '', url);
      return next;
    });
  }, []);

  return [filters, setFilters];
}
