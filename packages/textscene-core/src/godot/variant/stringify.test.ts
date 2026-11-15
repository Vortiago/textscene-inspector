import { describe, expect, it } from 'vitest';
import { stringify } from './stringify.js';
import { variant } from './value/variant.js';

// Each expected text is Godot 4.6.3's `str()` of the same value.
describe('stringify', () => {
  it('writes a whole float with its trailing .0', () => {
    expect(stringify(variant('FLOAT', 1))).toBe('1.0');
  });

  it('writes a Vector2 and a Vector2i', () => {
    expect([
      stringify(variant('VECTOR2', { x: 1, y: 2.5 })),
      stringify(variant('VECTOR2I', { x: 1, y: -2 })),
    ]).toEqual(['(1.0, 2.5)', '(1, -2)']);
  });

  it('writes a quaternion without trailing .0', () => {
    expect(stringify(variant('QUATERNION', { x: 0, y: 0, z: 0, w: 1 }))).toBe('(0, 0, 0, 1)');
  });

  it('writes a colour', () => {
    expect(stringify(variant('COLOR', { r: 1, g: 0.5, b: 0.25, a: 1 }))).toBe('(1.0, 0.5, 0.25, 1.0)');
  });

  it('writes a Rect2, a Transform2D and a Plane', () => {
    expect([
      stringify(variant('RECT2', { x: 1, y: 2, w: 3, h: 4 })),
      stringify(variant('TRANSFORM2D', { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 })),
      stringify(variant('PLANE', { normal: { x: 0, y: 1, z: 0 }, d: 2 })),
    ]).toEqual([
      '[P: (1.0, 2.0), S: (3.0, 4.0)]',
      '[X: (1.0, 0.0), Y: (0.0, 1.0), O: (0.0, 0.0)]',
      '[N: (0.0, 1.0, 0.0), D: 2]',
    ]);
  });

  it('writes a basis by its columns', () => {
    expect(stringify(variant('BASIS', [1, 0, 0, 0, 1, 0, 0, 0, 1]))).toBe(
      '[X: (1.0, 0.0, 0.0), Y: (0.0, 1.0, 0.0), Z: (0.0, 0.0, 1.0)]'
    );
  });

  it('quotes and escapes the strings inside an array', () => {
    const array = variant('ARRAY', [
      variant('INT', 1n),
      variant('STRING', 'a\n'),
      variant('STRING_NAME', 'n'),
      variant('NODE_PATH', 'p'),
    ]);
    expect(stringify(array)).toBe('[1, "a\\n", &"n", ^"p"]');
  });

  it('writes a dictionary and a packed float array', () => {
    expect([
      stringify(variant('DICTIONARY', [{ key: variant('STRING', 'k'), value: variant('INT', 1n) }])),
      stringify(variant('PACKED_FLOAT32_ARRAY', [1.5, 2])),
    ]).toEqual(['{ "k": 1 }', '[1.5, 2.0]']);
  });

  it('writes null and the empty RID', () => {
    expect([stringify(variant('NIL', null)), stringify(variant('RID', 0n))]).toEqual(['<null>', 'RID(0)']);
  });
});
