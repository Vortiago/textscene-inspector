import { describe, expect, it } from 'vitest';
import { withKey, withoutKey } from './keySet.js';

describe('withKey', () => {
  it('adds a missing key in a new set', () => {
    const keys = new Set(['a']);
    expect([...withKey(keys, 'b')]).toEqual(['a', 'b']);
    expect([...keys]).toEqual(['a']);
  });

  it('returns the same set for a key it holds', () => {
    const keys = new Set(['a']);
    expect(withKey(keys, 'a')).toBe(keys);
  });
});

describe('withoutKey', () => {
  it('removes a held key in a new set', () => {
    const keys = new Set(['a', 'b']);
    expect([...withoutKey(keys, 'a')]).toEqual(['b']);
    expect([...keys]).toEqual(['a', 'b']);
  });

  it('returns the same set for a key it lacks', () => {
    const keys = new Set(['a']);
    expect(withoutKey(keys, 'b')).toBe(keys);
  });
});
