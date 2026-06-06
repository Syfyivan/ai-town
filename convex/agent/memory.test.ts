import { normalizeMemoryScore } from './memory';

describe('normalizeMemoryScore', () => {
  test('returns 0 for equal range boundaries', () => {
    expect(normalizeMemoryScore(5, [5, 5])).toBe(0);
  });

  test('normalizes values within a range', () => {
    expect(normalizeMemoryScore(7, [3, 11])).toBe(0.5);
  });
});
