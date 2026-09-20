export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export type Room = {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  bufferMinutes: number;
};

export type Booking = {
  id: string;
  roomId: string;
  title: string;
  client: string;
  start: string;
  end: string;
  status: BookingStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type Slot = {
  start: string;
  end: string;
};

export type AvailabilityResponse = {
  roomId: string;
  date: string;
  durationMinutes: number;
  timeZone: string;
  slots: Slot[];
};

export type ListBookingsResponse = {
  items: Booking[];
  nextCursor: string | null;
  total: number;
};

export type ApiErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_LIMIT'
  | 'INVALID_CURSOR'
  | 'INVALID_RANGE'
  | 'NOT_FOUND'
  | 'OVERLAP'
  | 'VERSION_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'OUTSIDE_HOURS'
  | 'INVALID_TRANSITION'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE';

export type ApiErrorBody = {
  error: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};
