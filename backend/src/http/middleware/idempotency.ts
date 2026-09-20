import type { RequestHandler } from 'express';
import type { Config } from '../../config.js';

type CachedResponse = {
  status: number;
  body: unknown;
  expiresAt: number;
};

// Solo aplica a POST (el único método con semántica de idempotencia en el
// enunciado). Una clave repetida con un cuerpo distinto igualmente devuelve
// la reserva creada la primera vez: no se compara el cuerpo contra la clave.
export function createIdempotencyMiddleware(config: Pick<Config, 'idempotencyTtlMs'>): RequestHandler {
  const responsesByKey = new Map<string, CachedResponse>();

  function pruneExpired(now: number): void {
    for (const [key, entry] of responsesByKey) {
      if (entry.expiresAt <= now) {
        responsesByKey.delete(key);
      }
    }
  }

  return (req, res, next) => {
    if (req.method !== 'POST') {
      next();
      return;
    }

    const key = req.header('Idempotency-Key');
    if (!key) {
      next();
      return;
    }

    const now = Date.now();
    pruneExpired(now);

    const cached = responsesByKey.get(key);
    if (cached) {
      res.status(200).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        responsesByKey.set(key, { status: res.statusCode, body, expiresAt: now + config.idempotencyTtlMs });
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}
