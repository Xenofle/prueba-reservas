import type { RequestHandler } from 'express';
import type { Config } from '../../config.js';

export function createLatencyMiddleware(config: Pick<Config, 'latencyMinMs' | 'latencyMaxMs'>): RequestHandler {
  return (_req, _res, next) => {
    if (config.latencyMaxMs <= 0) {
      next();
      return;
    }

    const min = Math.max(0, Math.min(config.latencyMinMs, config.latencyMaxMs));
    const max = Math.max(config.latencyMinMs, config.latencyMaxMs);
    const delayMs = min + Math.random() * (max - min);

    setTimeout(next, delayMs);
  };
}
