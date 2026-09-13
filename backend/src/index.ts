import { createApp } from './http/app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp();

app.listen(config.port, () => {
  console.log(`Backend escuchando en http://localhost:${config.port}`);
});
