import { Router } from 'express';
import type { ListBookingsQuery, Store, UpdateBookingInput } from '../../data/store.js';
import type { BookingStatus } from '../../domain/types.js';
import { AppError } from '../errors.js';
import { asOptionalString, withOptional } from '../params.js';

const VALID_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'cancelled'];

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError('VALIDATION_ERROR', `El campo "${field}" es obligatorio.`, { field });
  }
  return value;
}

function requireVersion(value: unknown): number {
  const version = typeof value === 'string' ? Number(value) : value;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new AppError(
      'VALIDATION_ERROR',
      'El campo "version" es obligatorio y debe ser un entero mayor o igual a 1.',
      { field: 'version' },
    );
  }
  return version;
}

function optionalStatus(value: unknown): BookingStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !VALID_STATUSES.includes(value as BookingStatus)) {
    throw new AppError('VALIDATION_ERROR', 'El campo "status" no es válido.', { field: 'status' });
  }
  return value as BookingStatus;
}

export function createBookingsRouter(store: Store): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const query: ListBookingsQuery = {};
    withOptional(query, 'q', asOptionalString(req.query.q));
    withOptional(query, 'roomId', asOptionalString(req.query.roomId));
    withOptional(query, 'status', asOptionalString(req.query.status));
    withOptional(query, 'from', asOptionalString(req.query.from));
    withOptional(query, 'to', asOptionalString(req.query.to));
    withOptional(query, 'cursor', asOptionalString(req.query.cursor));
    withOptional(query, 'limit', asOptionalString(req.query.limit));

    res.json(store.listBookings(query));
  });

  router.get('/:id', (req, res) => {
    const booking = store.getBookingById(req.params.id);
    if (!booking) {
      throw new AppError('NOT_FOUND', `No existe la reserva "${req.params.id}".`);
    }
    res.json(booking);
  });

  router.post('/', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const booking = store.createBooking({
      roomId: requireString(body, 'roomId'),
      title: requireString(body, 'title'),
      client: requireString(body, 'client'),
      start: requireString(body, 'start'),
      end: requireString(body, 'end'),
    });
    res.status(201).json(booking);
  });

  router.patch('/:id', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const patch: UpdateBookingInput = { version: requireVersion(body.version) };
    withOptional(patch, 'roomId', asOptionalString(body.roomId));
    withOptional(patch, 'title', asOptionalString(body.title));
    withOptional(patch, 'client', asOptionalString(body.client));
    withOptional(patch, 'start', asOptionalString(body.start));
    withOptional(patch, 'end', asOptionalString(body.end));
    withOptional(patch, 'status', optionalStatus(body.status));

    const booking = store.updateBooking(req.params.id, patch);
    res.json(booking);
  });

  router.delete('/:id', (req, res) => {
    store.deleteBooking(req.params.id, requireVersion(req.query.version));
    res.status(204).send();
  });

  return router;
}
