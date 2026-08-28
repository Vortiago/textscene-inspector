/**
 * A packed slot accepts three spellings, not one.
 *
 * `can_convert_strict` lists ARRAY as a valid source for every PACKED_* type
 * (`variant.cpp:467-473`), and the write converts. Verified on godot 4.6.3:
 * `filters = ["*.png"]`, `points = [Vector2(0, 0), Vector2(5, 5)]` and
 * `split_offsets = Array[int]([3, 7])` all load into their packed slots.
 */

import { describe, it, expect } from 'vitest';
import { v } from '../v.js';

const points = v.packedVector2Array('points');
const at = (value: string) => points('points', value, 1);

describe('a PackedVector2Array slot', () => {
  it('accepts the packed spelling Godot writes', () => {
    expect(at('PackedVector2Array(0, 0, 5, 5)')).toBeNull();
  });

  it('accepts the bare array spelling the slot converts', () => {
    expect(at('[Vector2(0, 0), Vector2(5, 5)]')).toBeNull();
  });

  it('accepts the typed-array spelling', () => {
    expect(at('Array[Vector2]([Vector2(0, 0), Vector2(5, 5)])')).toBeNull();
  });

  it('accepts an empty array in every spelling', () => {
    expect(at('PackedVector2Array()')).toBeNull();
    expect(at('[]')).toBeNull();
    expect(at('Array[Vector2]([])')).toBeNull();
  });

  it('still reports an element that is not a Vector2', () => {
    expect(at('[Vector3(0, 0, 0)]')?.severity).toBe('error');
    expect(at('[oops]')?.severity).toBe('error');
  });

  it('still reports a non-numeric component in the packed spelling', () => {
    expect(at('PackedVector2Array(0, oops)')?.severity).toBe('error');
  });

  it('reports a value that is no array at all', () => {
    expect(at('Vector2(0, 0)')?.severity).toBe('error');
  });
});

describe('a PackedFloat32Array slot', () => {
  const offsets = v.packedFloat32Array('offsets', '0, 1');
  const f = (value: string) => offsets('offsets', value, 1);

  it('accepts all three spellings of a scalar array', () => {
    expect(f('PackedFloat32Array(0, 1)')).toBeNull();
    expect(f('[0, 1]')).toBeNull();
    expect(f('Array[float]([0, 1])')).toBeNull();
  });

  it('still reports a non-numeric element', () => {
    expect(f('[0, oops]')?.severity).toBe('error');
  });
});
