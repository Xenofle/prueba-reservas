import type { RequestHandler } from 'express';
import type { Config } from '../../config.js';
import { AppError } from '../errors.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function createRateLimitMiddleware(
  config: Pick<Config, 'rateLimitMax' | 'rateLimitWindowMs'>,
): RequestHandler {
  const writeTimestampsByClient = new Map<string, number[]>();

  return (req, _res, next) => {
    if (!WRITE_METHODS.has(req.method)) {
      next();
      return;
    }

    const clientKey = req.ip ?? 'unknown';
    const now = Date.now();
    const windowStart = now - config.rateLimitWindowMs;

    const recentWrites = (writeTimestampsByClient.get(clientKey) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (recentWrites.length >= config.rateLimitMax) {
      const oldest = recentWrites[0];
      const retryAfterMs =
        oldest !== undefined ? oldest + config.rateLimitWindowMs - now : config.rateLimitWindowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

      next(
        new AppError('RATE_LIMITED', 'Demasiadas escrituras en poco tiempo, inténtalo más tarde.', {
          retryAfter: retryAfterSeconds,
        }),
      );
      return;
    }

    recentWrites.push(now);
    writeTimestampsByClient.set(clientKey, recentWrites);
    next();
  };
}
