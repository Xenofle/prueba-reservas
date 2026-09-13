const COMBINING_DIACRITICS_START = 0x0300;
const COMBINING_DIACRITICS_END = 0x036f;

function stripDiacritics(value: string): string {
  let result = '';
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    const isDiacritic =
      codePoint !== undefined &&
      codePoint >= COMBINING_DIACRITICS_START &&
      codePoint <= COMBINING_DIACRITICS_END;
    if (!isDiacritic) {
      result += char;
    }
  }
  return result;
}

export function normalizeForSearch(value: string): string {
  return stripDiacritics(value.normalize('NFD')).toLowerCase();
}

export function matchesQuery(query: string, fields: string[]): boolean {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (normalizedQuery === '') return true;

  return fields.some((field) => normalizeForSearch(field).includes(normalizedQuery));
}
