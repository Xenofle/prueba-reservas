import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors.js';

// express.json() (body-parser) lanza un SyntaxError con `status: 400` y una
// propiedad `body` cuando el cuerpo no es JSON válido; no es una instancia de
// AppError, así que hay que reconocerlo aparte para no caer en el 500.
function isBodyParserSyntaxError(err: unknown): boolean {
  return (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: unknown }).status === 400 &&
    'body' in err
  );
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const normalizedErr = isBodyParserSyntaxError(err)
    ? new AppError('INVALID_JSON', 'El cuerpo de la petición no es JSON válido.')
    : err;

  if (normalizedErr instanceof AppError) {
    const retryAfter = normalizedErr.details?.retryAfter;
    if (typeof retryAfter === 'number') {
      res.setHeader('Retry-After', String(retryAfter));
    }

    res.status(normalizedErr.status).json({
      error: normalizedErr.code,
      message: normalizedErr.message,
      ...(normalizedErr.details ? { details: normalizedErr.details } : {}),
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno inesperado.' });
};
