import { describe, expect, it } from 'vitest';
import {
  compareByStartThenId,
  decodeCursor,
  encodeCursor,
  isAfterCursor,
  type Cursor,
} from './cursor.js';

describe('encodeCursor / decodeCursor', () => {
  it('decodifica lo que codificó', () => {
    const cursor: Cursor = { start: '2026-09-09T08:00:00.000Z', id: 'b42' };
    const encoded = encodeCursor(cursor);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it('devuelve null ante un cursor ilegible', () => {
    expect(decodeCursor('esto-no-es-base64-válido-@@@')).toBeNull();
    expect(decodeCursor(Buffer.from('no es json').toString('base64'))).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64'))).toBeNull();
  });
});

describe('paginación por cursor', () => {
  function makeItems(count: number): Cursor[] {
    const items: Cursor[] = [];
    for (let i = 0; i < count; i++) {
      // Varios ids comparten el mismo `start` para forzar el desempate.
      const start = `2026-09-09T${String(9 + Math.floor(i / 3)).padStart(2, '0')}:00:00.000Z`;
      items.push({ start, id: `b${String(i).padStart(2, '0')}` });
    }
    return items;
  }

  function paginate(allSorted: Cursor[], limit: number): Cursor[][] {
    const pages: Cursor[][] = [];
    let cursor: Cursor | null = null;

    for (;;) {
      const remaining: Cursor[] = cursor
        ? allSorted.filter((item) => isAfterCursor(item, cursor as Cursor))
        : allSorted;
      const page: Cursor[] = remaining.slice(0, limit);
      if (page.length === 0) break;
      pages.push(page);
      const lastItem: Cursor | undefined = page[page.length - 1];
      if (lastItem === undefined) break;
      cursor = lastItem;
      if (page.length < limit) break;
    }

    return pages;
  }

  it('recorre todas las páginas sin saltar ni repetir filas', () => {
    const items = makeItems(23);
    const sorted = [...items].sort(compareByStartThenId);

    const pages = paginate(sorted, 5);
    const flattened = pages.flat();

    expect(flattened).toEqual(sorted);

    const ids = flattened.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(flattened.length).toBe(items.length);
  });

  it('el cursor codificado y decodificado produce la misma página siguiente', () => {
    const items = makeItems(10);
    const sorted = [...items].sort(compareByStartThenId);

    const firstPage = sorted.slice(0, 4);
    const lastOfFirstPage = firstPage[firstPage.length - 1];
    if (lastOfFirstPage === undefined) throw new Error('página vacía inesperada');

    const roundTrippedCursor = decodeCursor(encodeCursor(lastOfFirstPage));
    expect(roundTrippedCursor).toEqual(lastOfFirstPage);

    const nextPageDirect = sorted.filter((item) => isAfterCursor(item, lastOfFirstPage));
    const nextPageViaCursor = roundTrippedCursor
      ? sorted.filter((item) => isAfterCursor(item, roundTrippedCursor))
      : [];

    expect(nextPageViaCursor).toEqual(nextPageDirect);
  });
});
