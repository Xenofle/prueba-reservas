export type Cursor = {
  start: string;
  id: string;
};

export function encodeCursor(cursor: Cursor): string {
  const json = JSON.stringify({ start: cursor.start, id: cursor.id });
  return Buffer.from(json, 'utf-8').toString('base64');
}

export function decodeCursor(raw: string): Cursor | null {
  let json: string;
  try {
    json = Buffer.from(raw, 'base64').toString('utf-8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.start !== 'string' || typeof candidate.id !== 'string') {
    return null;
  }

  return { start: candidate.start, id: candidate.id };
}

export function isAfterCursor(item: Cursor, cursor: Cursor): boolean {
  if (item.start !== cursor.start) {
    return item.start > cursor.start;
  }
  return item.id > cursor.id;
}

export function compareByStartThenId(a: Cursor, b: Cursor): number {
  if (a.start !== b.start) {
    return a.start < b.start ? -1 : 1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
