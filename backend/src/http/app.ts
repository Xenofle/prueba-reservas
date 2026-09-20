import express, { type Express } from 'express';
import { buildSeedData } from '../data/seed.js';
import { createStore, type Store } from '../data/store.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createBookingsRouter } from './routes/bookings.js';
import { createRoomsRouter } from './routes/rooms.js';

export function createApp(store: Store = createStore(buildSeedData())): Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/rooms', createRoomsRouter(store));
  app.use('/api/bookings', createBookingsRouter(store));

  app.use(errorHandler);

  return app;
}
