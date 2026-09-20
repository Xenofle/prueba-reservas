import express, { type Express } from 'express';
import { loadConfig, type Config } from '../config.js';
import { buildSeedData } from '../data/seed.js';
import { createStore, type Store } from '../data/store.js';
import { createChaosMiddleware } from './middleware/chaos.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createIdempotencyMiddleware } from './middleware/idempotency.js';
import { createLatencyMiddleware } from './middleware/latency.js';
import { createRateLimitMiddleware } from './middleware/rateLimit.js';
import { createBookingsRouter } from './routes/bookings.js';
import { createRoomsRouter } from './routes/rooms.js';

export function createApp(
  store: Store = createStore(buildSeedData()),
  config: Config = loadConfig(),
): Express {
  const app = express();
  app.use(express.json());

  // Orden importa: la idempotencia va antes que el rate limit para que un
  // replay con clave ya cacheada no consuma cupo de escritura, y antes que
  // el caos para que ese replay tampoco dependa de superar el sorteo de
  // nuevo. El caos, a su vez, va siempre antes de las rutas para no llegar
  // nunca a tocar el store.
  app.use(createLatencyMiddleware(config));
  app.use(createIdempotencyMiddleware(config));
  app.use(createRateLimitMiddleware(config));
  app.use(createChaosMiddleware(config));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/rooms', createRoomsRouter(store));
  app.use('/api/bookings', createBookingsRouter(store));

  app.use(errorHandler);

  return app;
}
