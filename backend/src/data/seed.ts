import { DateTime } from 'luxon';
import { STUDIO_TIME_ZONE } from '../domain/availability.js';
import { findOverlaps } from '../domain/overlap.js';
import type { Booking, BookingStatus, Room } from '../domain/types.js';

const SEED_ROOMS: Room[] = [
  { id: 'sala-norte', name: 'Sala Norte', openTime: '09:00', closeTime: '20:00', bufferMinutes: 15 },
  { id: 'sala-sur', name: 'Sala Sur', openTime: '10:00', closeTime: '22:00', bufferMinutes: 30 },
  { id: 'cabina-voz', name: 'Cabina de Voz', openTime: '08:00', closeTime: '18:00', bufferMinutes: 0 },
];

const BOOKING_COUNT = 100;
const DAY_OFFSET_MIN = -7;
const DAY_OFFSET_MAX = 14;
const DURATION_STEP_MINUTES = 15;
const MIN_DURATION_MINUTES = 30;
const MAX_DURATION_MINUTES = 240;
const MAX_TOTAL_ATTEMPTS = BOOKING_COUNT * 100;

const STATUS_POOL: BookingStatus[] = [
  'pending',
  'pending',
  'confirmed',
  'confirmed',
  'confirmed',
  'cancelled',
];

const TITLES = [
  'Ensayo de banda',
  'Grabación de voz en off',
  'Sesión de mezcla',
  'Podcast semanal',
  'Clase de canto',
  'Composición a piano',
  'Locución publicitaria',
  'Masterización de EP',
  'Rodaje de videoclip',
  'Sesión de batería',
];

const CLIENTS = [
  'Álvaro García',
  'Lucía Fernández',
  'Marta Jiménez',
  'José Contreras',
  'Beatriz Núñez',
  'Íñigo Sáez',
  'Rocío Peña',
  'Diego Ibáñez',
  'Nuria Vázquez',
  'Pablo Ruiz',
];

// Generador determinista (mulberry32): misma semilla, misma secuencia siempre.
function createRng(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom<T>(items: T[], rng: () => number): T {
  const index = Math.floor(rng() * items.length);
  const item = items[Math.min(index, items.length - 1)];
  if (item === undefined) throw new Error('Lista vacía en pickFrom');
  return item;
}

function toLocalTimeMinutes(time: string): number {
  const parts = time.split(':');
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  return hour * 60 + minute;
}

function buildCandidate(
  room: Room,
  anchor: DateTime,
  rng: () => number,
): { start: string; end: string } {
  const dayOffset = DAY_OFFSET_MIN + Math.floor(rng() * (DAY_OFFSET_MAX - DAY_OFFSET_MIN + 1));
  const localDay = anchor.plus({ days: dayOffset }).toISODate();
  if (!localDay) throw new Error('Fecha local inválida al generar el seed');

  const openMinutes = toLocalTimeMinutes(room.openTime);
  const closeMinutes = toLocalTimeMinutes(room.closeTime);

  const durationSteps =
    Math.floor((MAX_DURATION_MINUTES - MIN_DURATION_MINUTES) / DURATION_STEP_MINUTES) + 1;
  const durationMinutes =
    MIN_DURATION_MINUTES + Math.floor(rng() * durationSteps) * DURATION_STEP_MINUTES;

  const lastPossibleStart = closeMinutes - durationMinutes;
  const startSteps = Math.floor((lastPossibleStart - openMinutes) / DURATION_STEP_MINUTES) + 1;
  const startMinutes = openMinutes + Math.floor(rng() * Math.max(startSteps, 1)) * DURATION_STEP_MINUTES;

  const startLocal = DateTime.fromISO(localDay, { zone: STUDIO_TIME_ZONE }).set({
    hour: Math.floor(startMinutes / 60),
    minute: startMinutes % 60,
    second: 0,
    millisecond: 0,
  });
  const endLocal = startLocal.plus({ minutes: durationMinutes });

  const startIso = startLocal.toUTC().toISO();
  const endIso = endLocal.toUTC().toISO();
  if (!startIso || !endIso) throw new Error('No se pudo generar una fecha ISO en el seed');

  return { start: startIso, end: endIso };
}

export function buildSeedRooms(): Room[] {
  return SEED_ROOMS.map((room) => ({ ...room }));
}

export function buildSeedBookings(rooms: Room[], anchor: DateTime): Booking[] {
  const rng = createRng(20260909);
  const bookings: Booking[] = [];
  const nowIso = anchor.toUTC().toISO();
  if (!nowIso) throw new Error('No se pudo fijar la fecha de creación del seed');

  let created = 0;
  let attempts = 0;

  while (created < BOOKING_COUNT && attempts < MAX_TOTAL_ATTEMPTS) {
    attempts += 1;

    const room = pickFrom(rooms, rng);
    const candidate = buildCandidate(room, anchor, rng);
    const status = pickFrom(STATUS_POOL, rng);

    const conflicts =
      status === 'cancelled'
        ? []
        : findOverlaps(candidate, room.id, room.bufferMinutes, bookings);

    if (conflicts.length > 0) {
      continue;
    }

    const id = `booking-${String(created + 1).padStart(4, '0')}`;
    bookings.push({
      id,
      roomId: room.id,
      title: pickFrom(TITLES, rng),
      client: pickFrom(CLIENTS, rng),
      start: candidate.start,
      end: candidate.end,
      status,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    created += 1;
  }

  return bookings;
}

export function buildSeedData(anchor: DateTime = DateTime.now().setZone(STUDIO_TIME_ZONE)): {
  rooms: Room[];
  bookings: Booking[];
} {
  const rooms = buildSeedRooms();
  const bookings = buildSeedBookings(rooms, anchor);
  return { rooms, bookings };
}
