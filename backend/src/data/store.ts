import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { isWithinRoomHours } from '../domain/availability.js';
import { compareByStartThenId, decodeCursor, encodeCursor, type Cursor, isAfterCursor } from '../domain/cursor.js';
import { overlapsRange, resolveListingRange } from '../domain/dateRange.js';
import { findOverlaps } from '../domain/overlap.js';
import { matchesQuery } from '../domain/search.js';
import { canTransition, isMovable } from '../domain/transitions.js';
import type { Booking, BookingStatus, Room } from '../domain/types.js';
import { validateBookingInput } from '../domain/validation.js';
import { AppError } from '../http/errors.js';

const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 1;
const MAX_LIMIT = 20;
const VALID_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'cancelled'];

export type CreateBookingInput = {
  roomId: string;
  title: string;
  client: string;
  start: string;
  end: string;
};

export type UpdateBookingInput = {
  version: number;
  roomId?: string;
  title?: string;
  client?: string;
  start?: string;
  end?: string;
  status?: BookingStatus;
};

export type ListBookingsQuery = {
  q?: string;
  roomId?: string;
  status?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: string;
};

export type ListBookingsResult = {
  items: Booking[];
  nextCursor: string | null;
  total: number;
};

function nowIso(): string {
  const iso = DateTime.now().toUTC().toISO();
  if (!iso) throw new Error('No se pudo generar la fecha actual');
  return iso;
}

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;

  if (!/^\d+$/.test(raw)) {
    throw new AppError('INVALID_LIMIT', 'El parámetro "limit" debe ser un entero entre 1 y 20.');
  }

  const limit = Number(raw);
  if (limit < MIN_LIMIT || limit > MAX_LIMIT) {
    throw new AppError('INVALID_LIMIT', 'El parámetro "limit" debe ser un entero entre 1 y 20.');
  }

  return limit;
}

function parseCursor(raw: string | undefined): Cursor | null {
  if (raw === undefined) return null;

  const cursor = decodeCursor(raw);
  if (!cursor) {
    throw new AppError('INVALID_CURSOR', 'El cursor no es válido.');
  }

  return cursor;
}

function parseStatusFilter(raw: string | undefined): BookingStatus | undefined {
  if (raw === undefined) return undefined;

  if (!VALID_STATUSES.includes(raw as BookingStatus)) {
    throw new AppError('VALIDATION_ERROR', `El estado "${raw}" no es válido.`, { field: 'status' });
  }

  return raw as BookingStatus;
}

export type Store = ReturnType<typeof createStore>;

export function createStore(seed: { rooms: Room[]; bookings: Booking[] }) {
  const rooms = seed.rooms;
  let bookings = seed.bookings;

  function listRooms(): Room[] {
    return rooms;
  }

  function getRoomById(id: string): Room | undefined {
    return rooms.find((room) => room.id === id);
  }

  function getBookingById(id: string): Booking | undefined {
    return bookings.find((booking) => booking.id === id);
  }

  function listBookingsByRoom(roomId: string): Booking[] {
    return bookings.filter((booking) => booking.roomId === roomId);
  }

  function listBookings(query: ListBookingsQuery): ListBookingsResult {
    const limit = parseLimit(query.limit);
    const cursor = parseCursor(query.cursor);
    const status = parseStatusFilter(query.status);

    const rangeInput: { from?: string; to?: string } = {};
    if (query.from !== undefined) rangeInput.from = query.from;
    if (query.to !== undefined) rangeInput.to = query.to;
    const range = resolveListingRange(rangeInput);
    if (!range) {
      throw new AppError('INVALID_RANGE', 'El rango "from"/"to" no es válido.');
    }

    const filtered = bookings.filter((booking) => {
      if (query.roomId !== undefined && booking.roomId !== query.roomId) return false;
      if (status !== undefined && booking.status !== status) return false;
      if (!overlapsRange(booking.start, booking.end, range)) return false;
      if (query.q !== undefined && !matchesQuery(query.q, [booking.title, booking.client])) return false;
      return true;
    });

    const sorted = [...filtered].sort(compareByStartThenId);
    const total = sorted.length;

    const afterCursor = cursor ? sorted.filter((booking) => isAfterCursor(booking, cursor)) : sorted;
    const page = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const lastItem = page[page.length - 1];
    const nextCursor = hasMore && lastItem !== undefined ? encodeCursor(lastItem) : null;

    return { items: page, nextCursor, total };
  }

  function createBooking(input: CreateBookingInput): Booking {
    const room = getRoomById(input.roomId);
    if (!room) {
      throw new AppError('NOT_FOUND', `No existe la sala "${input.roomId}".`);
    }

    const validationError = validateBookingInput(input);
    if (validationError) {
      throw new AppError('VALIDATION_ERROR', validationError.message, { field: validationError.field });
    }

    if (!isWithinRoomHours({ room, start: input.start, end: input.end })) {
      throw new AppError('OUTSIDE_HOURS', 'La reserva no cabe en el horario de la sala.');
    }

    const conflicts = findOverlaps(input, room.id, room.bufferMinutes, bookings);
    if (conflicts.length > 0) {
      throw new AppError('OVERLAP', 'La sala ya está ocupada en ese tramo.', { conflicts });
    }

    const timestamp = nowIso();
    const booking: Booking = {
      id: randomUUID(),
      roomId: room.id,
      title: input.title,
      client: input.client,
      start: input.start,
      end: input.end,
      status: 'pending',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    bookings = [...bookings, booking];
    return booking;
  }

  function updateBooking(id: string, input: UpdateBookingInput): Booking {
    const current = getBookingById(id);
    if (!current) {
      throw new AppError('NOT_FOUND', `No existe la reserva "${id}".`);
    }

    if (current.version !== input.version) {
      throw new AppError('VERSION_CONFLICT', 'La reserva ha cambiado desde que se leyó.', {
        current,
      });
    }

    if (input.status !== undefined && input.status !== current.status) {
      if (!canTransition(current.status, input.status)) {
        throw new AppError(
          'INVALID_TRANSITION',
          `No se puede pasar de "${current.status}" a "${input.status}".`,
        );
      }
    }
    const nextStatus = input.status ?? current.status;

    const wantsMove = input.roomId !== undefined || input.start !== undefined || input.end !== undefined;
    if (wantsMove && !isMovable(nextStatus)) {
      throw new AppError('INVALID_TRANSITION', 'Una reserva cancelada no se puede mover.');
    }

    const nextRoomId = input.roomId ?? current.roomId;
    const room = getRoomById(nextRoomId);
    if (!room) {
      throw new AppError('NOT_FOUND', `No existe la sala "${nextRoomId}".`);
    }

    const nextTitle = input.title ?? current.title;
    const nextClient = input.client ?? current.client;
    const nextStart = input.start ?? current.start;
    const nextEnd = input.end ?? current.end;

    const validationError = validateBookingInput({
      title: nextTitle,
      client: nextClient,
      start: nextStart,
      end: nextEnd,
    });
    if (validationError) {
      throw new AppError('VALIDATION_ERROR', validationError.message, { field: validationError.field });
    }

    if (wantsMove) {
      if (!isWithinRoomHours({ room, start: nextStart, end: nextEnd })) {
        throw new AppError('OUTSIDE_HOURS', 'La reserva no cabe en el horario de la sala.');
      }

      const conflicts = findOverlaps(
        { start: nextStart, end: nextEnd },
        room.id,
        room.bufferMinutes,
        bookings,
        current.id,
      );
      if (conflicts.length > 0) {
        throw new AppError('OVERLAP', 'La sala ya está ocupada en ese tramo.', { conflicts });
      }
    }

    const updated: Booking = {
      ...current,
      roomId: nextRoomId,
      title: nextTitle,
      client: nextClient,
      start: nextStart,
      end: nextEnd,
      status: nextStatus,
      version: current.version + 1,
      updatedAt: nowIso(),
    };

    bookings = bookings.map((booking) => (booking.id === id ? updated : booking));
    return updated;
  }

  function deleteBooking(id: string, version: number): void {
    const current = getBookingById(id);
    if (!current) {
      throw new AppError('NOT_FOUND', `No existe la reserva "${id}".`);
    }

    if (current.version !== version) {
      throw new AppError('VERSION_CONFLICT', 'La reserva ha cambiado desde que se leyó.', {
        current,
      });
    }

    bookings = bookings.filter((booking) => booking.id !== id);
  }

  return {
    listRooms,
    getRoomById,
    getBookingById,
    listBookingsByRoom,
    listBookings,
    createBooking,
    updateBooking,
    deleteBooking,
  };
}
