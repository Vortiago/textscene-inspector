import { describe, expect, it } from 'vitest';
import { arraysEqual, describeNodePathMismatch } from './outliner.mjs';

describe('arraysEqual', () => {
  it('is true for two identical path lists in the same order', () => {
    expect(arraysEqual(['Root', 'Root/Box'], ['Root', 'Root/Box'])).toBe(true);
  });

  it('is false when a row is missing', () => {
    expect(arraysEqual(['Root', 'Root/Box', 'Root/Title'], ['Root', 'Root/Box'])).toBe(false);
  });

  it('is false when an extra row appears', () => {
    expect(arraysEqual(['Root', 'Root/Box'], ['Root', 'Root/Box', 'Root/Extra'])).toBe(false);
  });

  it('is false when the same rows appear in a different order', () => {
    expect(arraysEqual(['Root', 'Root/Box', 'Root/Title'], ['Root', 'Root/Title', 'Root/Box'])).toBe(
      false
    );
  });

  it('is false for non-array input', () => {
    expect(arraysEqual(null, ['Root'])).toBe(false);
    expect(arraysEqual(['Root'], undefined)).toBe(false);
  });
});

describe('describeNodePathMismatch', () => {
  it('reports nothing missing/extra for identical sets', () => {
    expect(describeNodePathMismatch(['Root', 'Root/Box'], ['Root', 'Root/Box'])).toEqual({
      missing: [],
      extra: [],
    });
  });

  it('reports a dropped row as missing', () => {
    expect(describeNodePathMismatch(['Root', 'Root/Box', 'Root/Title'], ['Root', 'Root/Box'])).toEqual({
      missing: ['Root/Title'],
      extra: [],
    });
  });

  it('reports an unexpected row as extra', () => {
    expect(describeNodePathMismatch(['Root', 'Root/Box'], ['Root', 'Root/Box', 'Root/Ghost'])).toEqual({
      missing: [],
      extra: ['Root/Ghost'],
    });
  });

  it('reports both sides of a reordering-free swap', () => {
    expect(describeNodePathMismatch(['Root', 'Root/Box'], ['Root', 'Root/Renamed'])).toEqual({
      missing: ['Root/Box'],
      extra: ['Root/Renamed'],
    });
  });
});
