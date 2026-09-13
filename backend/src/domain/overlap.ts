import { DateTime } from 'luxon';
import type { Booking } from './types.js';

export type Interval = {
  start: string;
  end: string;
};

export function isActiveStatus(status: Booking['status']): boolean {
  return status === 'pending' || status === 'confirmed';
}

function minutesBetween(a: DateTime, b: DateTime): number {
  return b.diff(a, 'minutes').minutes;
}

export function findOverlaps(
  candidate: Interval,
  roomId: string,
  bufferMinutes: number,
  existing: Booking[],
  excludeBookingId?: string,
): string[] {
  const candidateStart = DateTime.fromISO(candidate.start, { zone: 'utc' });
  const candidateEnd = DateTime.fromISO(candidate.end, { zone: 'utc' });

  return existing
    .filter((booking) => booking.roomId === roomId)
    .filter((booking) => isActiveStatus(booking.status))
    .filter((booking) => booking.id !== excludeBookingId)
    .filter((booking) => {
      const bookingStart = DateTime.fromISO(booking.start, { zone: 'utc' });
      const bookingEnd = DateTime.fromISO(booking.end, { zone: 'utc' });

      const gapAfterCandidate = minutesBetween(candidateEnd, bookingStart);
      const gapAfterBooking = minutesBetween(bookingEnd, candidateStart);

      const respectsBuffer =
        gapAfterCandidate >= bufferMinutes || gapAfterBooking >= bufferMinutes;

      return !respectsBuffer;
    })
    .map((booking) => booking.id);
}
