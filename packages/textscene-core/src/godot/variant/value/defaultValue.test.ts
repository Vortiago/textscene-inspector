import { describe, expect, it } from 'vitest';
import { defaultValue } from './defaultValue.js';

describe('defaultValue', () => {
  it('gives 0 as an int64', () => {
    expect(defaultValue('INT')).toEqual({ type: 'INT', value: 0n });
  });

  it('gives the identity quaternion', () => {
    expect(defaultValue('QUATERNION').value).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it('gives opaque black', () => {
    expect(defaultValue('COLOR').value).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('gives an empty packed array', () => {
    expect(defaultValue('PACKED_VECTOR3_ARRAY').value).toEqual([]);
  });
});
