import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Los tests que no pasan su propia config a createApp() usan loadConfig();
    // esto asegura que sean deterministas sin exportar variables a mano.
    env: {
      FAIL_RATE: '0',
      LATENCY_MIN_MS: '0',
      LATENCY_MAX_MS: '0',
    },
  },
});
