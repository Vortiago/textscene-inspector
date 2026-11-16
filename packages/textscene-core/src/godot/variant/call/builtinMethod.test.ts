import { describe, expect, it } from 'vitest';
import { builtinMethodHash } from './builtinMethod';

describe('builtinMethodHash', () => {
  it('reads the hash Godot 4.6.3 gives Vector2.angle in its extension API', () => {
    expect(builtinMethodHash('VECTOR2', 'angle')).toBe(466405837);
  });

  it('has no hash for an Object, which has no builtin method table', () => {
    expect(builtinMethodHash('OBJECT', 'free')).toBeUndefined();
  });

  it('has no hash for a name that is not a method of the type', () => {
    expect(builtinMethodHash('VECTOR2', 'x')).toBeUndefined();
  });
});
