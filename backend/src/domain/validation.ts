import { DateTime } from 'luxon';

export type ValidationField = 'title' | 'client' | 'start' | 'end';

export type ValidationError = {
  field: ValidationField;
  message: string;
};

export type BookingInput = {
  title: string;
  client: string;
  start: string;
  end: string;
};

const MIN_TEXT_LENGTH = 3;
const MAX_TEXT_LENGTH = 80;
const DURATION_STEP_MINUTES = 15;
const MIN_DURATION_MINUTES = 30;
const MAX_DURATION_MINUTES = 480;

function validateText(field: 'title' | 'client', value: string): ValidationError | null {
  const length = value.trim().length;
  if (length < MIN_TEXT_LENGTH || length > MAX_TEXT_LENGTH) {
    return {
      field,
      message: `El campo "${field}" debe tener entre ${MIN_TEXT_LENGTH} y ${MAX_TEXT_LENGTH} caracteres.`,
    };
  }
  return null;
}

export function validateBookingInput(input: BookingInput): ValidationError | null {
  const titleError = validateText('title', input.title);
  if (titleError) return titleError;

  const clientError = validateText('client', input.client);
  if (clientError) return clientError;

  const start = DateTime.fromISO(input.start, { zone: 'utc' });
  if (!start.isValid) {
    return { field: 'start', message: 'La fecha de inicio no es una fecha ISO válida.' };
  }

  const end = DateTime.fromISO(input.end, { zone: 'utc' });
  if (!end.isValid) {
    return { field: 'end', message: 'La fecha de fin no es una fecha ISO válida.' };
  }

  if (end <= start) {
    return { field: 'end', message: 'La fecha de fin debe ser posterior a la de inicio.' };
  }

  const durationMinutes = end.diff(start, 'minutes').minutes;
  const isValidStep = durationMinutes % DURATION_STEP_MINUTES === 0;
  const isValidRange =
    durationMinutes >= MIN_DURATION_MINUTES && durationMinutes <= MAX_DURATION_MINUTES;

  if (!isValidStep || !isValidRange) {
    return {
      field: 'end',
      message: `La duración debe ser múltiplo de ${DURATION_STEP_MINUTES} minutos y estar entre ${MIN_DURATION_MINUTES} y ${MAX_DURATION_MINUTES}.`,
    };
  }

  return null;
}
