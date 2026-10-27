import { describe, expect, it } from 'vitest';
import { identityKey } from './identityKey';

describe('identityKey', () => {
  it('gives one object one key every time', () => {
    const object = {};
    expect(identityKey(object)).toBe(identityKey(object));
  });

  it('gives two objects of equal content two keys', () => {
    expect(identityKey({ a: 1 })).not.toBe(identityKey({ a: 1 }));
  });
});
