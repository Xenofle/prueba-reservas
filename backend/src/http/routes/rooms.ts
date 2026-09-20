import { Router } from 'express';
import { DateTime } from 'luxon';
import type { Store } from '../../data/store.js';
import { computeAvailability, STUDIO_TIME_ZONE } from '../../domain/availability.js';
import { AppError } from '../errors.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createRoomsRouter(store: Store): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(store.listRooms());
  });

  router.get('/:id/availability', (req, res) => {
    const room = store.getRoomById(req.params.id);
    if (!room) {
      throw new AppError('NOT_FOUND', `No existe la sala "${req.params.id}".`);
    }

    const dateRaw = req.query.date;
    if (typeof dateRaw !== 'string' || !DATE_ONLY_PATTERN.test(dateRaw)) {
      throw new AppError('VALIDATION_ERROR', 'El parámetro "date" debe tener formato AAAA-MM-DD.', {
        field: 'date',
      });
    }
    if (!DateTime.fromISO(dateRaw, { zone: STUDIO_TIME_ZONE }).isValid) {
      throw new AppError('VALIDATION_ERROR', 'El parámetro "date" no es una fecha válida.', {
        field: 'date',
      });
    }

    const durationRaw = req.query.durationMinutes;
    const durationMinutes = typeof durationRaw === 'string' ? Number(durationRaw) : NaN;
    if (typeof durationRaw !== 'string' || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'El parámetro "durationMinutes" debe ser un entero positivo.',
        { field: 'durationMinutes' },
      );
    }

    const slots = computeAvailability({
      room,
      date: dateRaw,
      durationMinutes,
      bookings: store.listBookingsByRoom(room.id),
      now: DateTime.now().setZone(STUDIO_TIME_ZONE),
    });

    res.json({
      roomId: room.id,
      date: dateRaw,
      durationMinutes,
      timeZone: STUDIO_TIME_ZONE,
      slots,
    });
  });

  return router;
}
