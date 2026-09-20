import { DateTime } from 'luxon';
import { STUDIO_TIME_ZONE } from './availability.js';

export type RangeBounds = {
  fromUtc?: DateTime;
  toUtc?: DateTime;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseBoundary(value: string, edge: 'from' | 'to'): DateTime | null {
  if (DATE_ONLY_PATTERN.test(value)) {
    const localDay = DateTime.fromISO(value, { zone: STUDIO_TIME_ZONE });
    if (!localDay.isValid) return null;
    return edge === 'from' ? localDay.startOf('day') : localDay.endOf('day');
  }

  const instant = DateTime.fromISO(value, { zone: 'utc' });
  return instant.isValid ? instant : null;
}

export function resolveListingRange(params: { from?: string; to?: string }): RangeBounds | null {
  const bounds: RangeBounds = {};

  if (params.from !== undefined) {
    const fromUtc = parseBoundary(params.from, 'from');
    if (!fromUtc) return null;
    bounds.fromUtc = fromUtc.toUTC();
  }

  if (params.to !== undefined) {
    const toUtc = parseBoundary(params.to, 'to');
    if (!toUtc) return null;
    bounds.toUtc = toUtc.toUTC();
  }

  if (bounds.fromUtc && bounds.toUtc && bounds.fromUtc > bounds.toUtc) return null;

  return bounds;
}

export function overlapsRange(bookingStart: string, bookingEnd: string, bounds: RangeBounds): boolean {
  const start = DateTime.fromISO(bookingStart, { zone: 'utc' });
  const end = DateTime.fromISO(bookingEnd, { zone: 'utc' });

  if (bounds.fromUtc && end <= bounds.fromUtc) return false;
  if (bounds.toUtc && start > bounds.toUtc) return false;
  return true;
}
