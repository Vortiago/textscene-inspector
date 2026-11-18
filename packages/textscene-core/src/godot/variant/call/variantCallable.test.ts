import { describe, expect, it } from 'vitest';
import { variant, type Variant } from '../value/variant';
import { variantHash } from '../variantHash';
import { variantCallable } from './variantCallable';

describe('variantCallable', () => {
  it('keeps the hash its base had when it was made, as Godot does', () => {
    const elements: Variant[] = [variant('INT', 3n)];
    const has = variantCallable(variant('ARRAY', elements), 'has');
    const before = variantHash(has);
    elements.push(variant('INT', 4n));
    expect(variantHash(has)).toBe(before);
  });
});
