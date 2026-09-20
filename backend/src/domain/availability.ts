import { DateTime } from 'luxon';
import { findOverlaps } from './overlap.js';
import type { Booking, Room } from './types.js';

export const STUDIO_TIME_ZONE = 'Europe/Madrid';
const SLOT_STEP_MINUTES = 15;

export type Slot = {
  start: string;
  end: string;
};

function requireDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

function parseLocalTime(date: string, time: string): DateTime {
  const parts = time.split(':');
  const hour = Number(requireDefined(parts[0], `Hora inválida: ${time}`));
  const minute = Number(requireDefined(parts[1], `Hora inválida: ${time}`));

  return DateTime.fromISO(date, { zone: STUDIO_TIME_ZONE }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
}

function toUtcIso(dt: DateTime): string {
  const iso = dt.toUTC().toISO();
  return requireDefined(iso ?? undefined, 'No se pudo convertir la fecha a ISO');
}

export function isWithinRoomHours(params: { room: Room; start: string; end: string }): boolean {
  const { room, start, end } = params;

  const startUtc = DateTime.fromISO(start, { zone: 'utc' });
  const endUtc = DateTime.fromISO(end, { zone: 'utc' });
  if (!startUtc.isValid || !endUtc.isValid) return false;

  const localDate = startUtc.setZone(STUDIO_TIME_ZONE).toISODate();
  if (!localDate) return false;

  const openAt = parseLocalTime(localDate, room.openTime);
  const closeAt = parseLocalTime(localDate, room.closeTime);

  return startUtc >= openAt && endUtc <= closeAt;
}

export function computeAvailability(params: {
  room: Room;
  date: string;
  durationMinutes: number;
  bookings: Booking[];
  now: DateTime;
}): Slot[] {
  const { room, date, durationMinutes, bookings, now } = params;

  const openAt = parseLocalTime(date, room.openTime);
  const closeAt = parseLocalTime(date, room.closeTime);

  const slots: Slot[] = [];

  for (
    let slotStart = openAt;
    slotStart.plus({ minutes: durationMinutes }) <= closeAt;
    slotStart = slotStart.plus({ minutes: SLOT_STEP_MINUTES })
  ) {
    if (slotStart < now) continue;

    const slotEnd = slotStart.plus({ minutes: durationMinutes });
    const candidate = { start: toUtcIso(slotStart), end: toUtcIso(slotEnd) };

    const conflicts = findOverlaps(candidate, room.id, room.bufferMinutes, bookings);
    if (conflicts.length === 0) {
      slots.push(candidate);
    }
  }

  return slots;
}
