import { DateTime } from 'luxon';

export const STUDIO_TIME_ZONE = 'Europe/Madrid';

function requireIso(iso: string | null, message: string): string {
  if (iso === null) throw new Error(message);
  return iso;
}

// Convierte una fecha y hora tal como las elige la persona (hora local del
// estudio) al instante UTC que espera la API. Nunca aritmética manual sobre
// Date: Luxon resuelve el desfase correcto incluso en el cambio de hora.
export function localDateTimeToUtcIso(localDate: string, localTime: string): string {
  const [hourRaw, minuteRaw] = localTime.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  const local = DateTime.fromISO(localDate, { zone: STUDIO_TIME_ZONE }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });

  if (!local.isValid) {
    throw new Error(`Fecha u hora local inválida: ${localDate} ${localTime}`);
  }

  return requireIso(local.toUTC().toISO(), 'No se pudo convertir la fecha local a UTC');
}

// Y a la inversa: de un instante UTC de la API al día/hora que se le muestra
// a la persona, siempre en Europe/Madrid, sin depender de la zona del navegador.
export function utcIsoToLocalDate(isoUtc: string): string {
  const local = DateTime.fromISO(isoUtc, { zone: 'utc' }).setZone(STUDIO_TIME_ZONE);
  if (!local.isValid) {
    throw new Error(`Instante UTC inválido: ${isoUtc}`);
  }
  const date = local.toISODate();
  if (date === null) throw new Error('No se pudo obtener la fecha local');
  return date;
}

export function utcIsoToLocalTime(isoUtc: string): string {
  const local = DateTime.fromISO(isoUtc, { zone: 'utc' }).setZone(STUDIO_TIME_ZONE);
  if (!local.isValid) {
    throw new Error(`Instante UTC inválido: ${isoUtc}`);
  }
  return local.toFormat('HH:mm');
}

// Formato legible para mostrar en el listado: día, mes y hora en la zona del
// estudio, tal cual el enunciado exige (nunca el locale por defecto del navegador).
export function formatLocalDateTime(isoUtc: string): string {
  const local = DateTime.fromISO(isoUtc, { zone: 'utc' }).setZone(STUDIO_TIME_ZONE);
  if (!local.isValid) {
    throw new Error(`Instante UTC inválido: ${isoUtc}`);
  }
  return local.setLocale('es-ES').toFormat("dd/MM/yyyy HH:mm");
}
