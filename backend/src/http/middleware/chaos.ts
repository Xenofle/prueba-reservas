import type { RequestHandler } from 'express';
import type { Config } from '../../config.js';
import { AppError } from '../errors.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// Se coloca antes de las rutas: nunca llega a tocar el store, así que
// una escritura fallida por caos no puede dejar datos a medias.
export function createChaosMiddleware(config: Pick<Config, 'failRate'>): RequestHandler {
  return (req, _res, next) => {
    if (!WRITE_METHODS.has(req.method)) {
      next();
      return;
    }

    if (config.failRate > 0 && Math.random() < config.failRate) {
      next(
        new AppError(
          'UPSTREAM_UNAVAILABLE',
          'Fallo temporal simulado; la escritura no se ha aplicado.',
        ),
      );
      return;
    }

    next();
  };
}
