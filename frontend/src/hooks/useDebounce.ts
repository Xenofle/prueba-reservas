import { useEffect, useState } from 'react';

// Devuelve `value` con retraso: cada cambio reinicia el temporizador, así
// que solo se propaga el último valor una vez pasan `delayMs` desde la
// última tecla (no uno intermedio por cada pulsación).
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
