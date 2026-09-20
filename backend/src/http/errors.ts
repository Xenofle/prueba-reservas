export type ErrorCode =
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

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_JSON: 400,
  INVALID_LIMIT: 400,
  INVALID_CURSOR: 400,
  INVALID_RANGE: 400,
  NOT_FOUND: 404,
  OVERLAP: 409,
  VERSION_CONFLICT: 409,
  VALIDATION_ERROR: 422,
  OUTSIDE_HOURS: 422,
  INVALID_TRANSITION: 422,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (details !== undefined) {
      this.details = details;
    }
  }
}
