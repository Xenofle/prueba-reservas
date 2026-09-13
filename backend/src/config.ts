function readInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readFloat(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export type Config = {
  port: number;
  latencyMinMs: number;
  latencyMaxMs: number;
  failRate: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  idempotencyTtlMs: number;
};

export function loadConfig(): Config {
  return {
    port: readInt('PORT', 3000),
    latencyMinMs: readInt('LATENCY_MIN_MS', 200),
    latencyMaxMs: readInt('LATENCY_MAX_MS', 600),
    failRate: readFloat('FAIL_RATE', 0.2),
    rateLimitMax: readInt('RATE_LIMIT_MAX', 10),
    rateLimitWindowMs: readInt('RATE_LIMIT_WINDOW_MS', 10000),
    idempotencyTtlMs: readInt('IDEMPOTENCY_TTL_MS', 600000),
  };
}
