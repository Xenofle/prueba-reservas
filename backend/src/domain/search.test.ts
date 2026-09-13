import { describe, expect, it } from 'vitest';
import { matchesQuery, normalizeForSearch } from './search.js';

describe('normalizeForSearch', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizeForSearch('Álvaro')).toBe('alvaro');
    expect(normalizeForSearch('SESIÓN')).toBe('sesion');
  });
});

describe('matchesQuery', () => {
  it('"alvaro" encuentra "Álvaro" ignorando mayúsculas y acentos', () => {
    expect(matchesQuery('alvaro', ['Reunión con Álvaro'])).toBe(true);
  });

  it('busca por subcadena, no requiere palabra completa', () => {
    expect(matchesQuery('alv', ['Álvaro García'])).toBe(true);
  });

  it('no encuentra coincidencias que no aparecen', () => {
    expect(matchesQuery('pedro', ['Álvaro García'])).toBe(false);
  });

  it('busca en cualquiera de los campos dados', () => {
    expect(matchesQuery('grabacion', ['Ensayo', 'Grabación S.L.'])).toBe(true);
  });

  it('una query vacía coincide con todo', () => {
    expect(matchesQuery('   ', ['Cualquier cosa'])).toBe(true);
  });
});
