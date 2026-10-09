import { describe, expect, it } from 'vitest';
import { enumNamesByValue } from './enumNames';

enum Shade {
  DARK = 0,
  LIGHT = 2,
}

describe('enumNamesByValue', () => {
  it('names each member by its integer', () => {
    expect(enumNamesByValue(Shade)).toEqual({ 0: 'DARK', 2: 'LIGHT' });
  });

  it('leaves out the reverse entries a numeric TS enum adds', () => {
    expect(Object.values(enumNamesByValue(Shade))).not.toContain('0');
  });

  it('gives an empty map for an enum with no numeric member', () => {
    expect(enumNamesByValue({})).toEqual({});
  });
});
