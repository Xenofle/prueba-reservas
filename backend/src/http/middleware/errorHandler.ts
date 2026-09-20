import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const retryAfter = err.details?.retryAfter;
    if (typeof retryAfter === 'number') {
      res.setHeader('Retry-After', String(retryAfter));
    }

    res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno inesperado.' });
};
