import { describe, expect, it } from 'vitest';
import { builtinMethodHash, builtinMethodRow } from './builtinMethod';

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

describe('builtinMethodRow', () => {
  it('reads the return type, flags and each argument with its default text', () => {
    const [name, returnType, flags, , parameters] = builtinMethodRow('VECTOR2', 'limit_length')!;
    expect([name, returnType, flags, parameters]).toEqual(['limit_length', 'Vector2', 1, [['float', '1.0']]]);
  });

  it('marks a static method with flag 2', () => {
    expect(builtinMethodRow('VECTOR2', 'from_angle')![2] & 2).toBe(2);
  });

  it('has no row for an Object or a name that is not a method', () => {
    expect(builtinMethodRow('OBJECT', 'free')).toBeUndefined();
    expect(builtinMethodRow('VECTOR2', 'x')).toBeUndefined();
  });
});
