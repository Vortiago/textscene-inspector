import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import { construct } from './construct.js';

// Each expected value is Godot 4.6.3's constructor of the same arguments.
describe('construct', () => {
  it('truncates the components of a Vector2i made from a Vector2', () => {
    expect(construct('VECTOR2I', [variant('VECTOR2', { x: 1.9, y: -1.9 })])).toEqual(
      variant('VECTOR2I', { x: 1, y: -1 })
    );
  });

  it('builds a Rect2 from a position and a size', () => {
    const position = variant('VECTOR2', { x: 1, y: 2 });
    const size = variant('VECTOR2', { x: 3, y: 4 });
    expect(construct('RECT2', [position, size])).toEqual(variant('RECT2', { x: 1, y: 2, w: 3, h: 4 }));
  });

  it('builds a colour from a name and an alpha', () => {
    expect(construct('COLOR', [variant('STRING', 'red'), variant('FLOAT', 0.5)])).toEqual(
      variant('COLOR', { r: 1, g: 0, b: 0, a: 0.5 })
    );
  });

  it('truncates the floats of an Array into a PackedInt32Array', () => {
    const array = variant('ARRAY', [variant('INT', 1n), variant('FLOAT', 2.7)]);
    expect(construct('PACKED_INT32_ARRAY', [array])).toEqual(variant('PACKED_INT32_ARRAY', [1, 2]));
  });

  it('takes an int where a float is asked', () => {
    expect(construct('VECTOR2', [variant('INT', 1n), variant('INT', 2n)])).toEqual(
      variant('VECTOR2', { x: 1, y: 2 })
    );
  });

  it('has no value for arguments no constructor takes', () => {
    expect(construct('VECTOR2', [variant('STRING', 'a'), variant('STRING', 'b')])).toBeUndefined();
  });
});
