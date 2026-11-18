import { describe, expect, it } from 'vitest';
import { variantToText } from '../variantWriter';
import { UnsupportedObject } from '../objects/makeObject';
import { bytesToVariant } from './decodeVariant';

const read = (bytes: number[]) => variantToText(bytesToVariant(bytes, false));

// Each value is what Godot 4.6.3's bytes_to_var returns for the bytes, written by var_to_str.
describe('bytesToVariant', () => {
  it('stops on an object id other than 0', () => {
    expect(() => bytesToVariant([24, 0, 1, 0, 7, 0, 0, 0, 0, 0, 0, 0], false)).toThrow(UnsupportedObject);
  });

  it('gives null for an object whose property count is missing', () => {
    expect(variantToText(bytesToVariant([24, 0, 0, 0, 4, 0, 0, 0, 78, 111, 100, 101], true))).toBe('null');
  });

  it('reads a 64-bit vector into float32 components', () => {
    const bytes = [5, 0, 1, 0, 0, 0, 0, 0, 0, 0, 240, 63, 154, 153, 153, 153, 153, 153, 185, 63];
    expect(read(bytes)).toBe('Vector2(1, 0.1)');
  });

  it('drops an element a typed array refuses and converts one it takes', () => {
    const bytes = [
      28, 0, 1, 0, 2, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 97, 0, 0, 0, 3, 0, 0, 0, 0, 0, 192, 63,
    ];
    expect(read(bytes)).toBe('Array[int]([1])');
  });

  it('gives null for bytes that end early or hold invalid UTF-8', () => {
    expect([read([4, 0, 0, 0, 1, 0, 0, 0, 97]), read([4, 0, 0, 0, 2, 0, 0, 0, 192, 128, 0, 0])]).toEqual([
      'null',
      'null',
    ]);
  });

  it('skips a leading BOM and stops a text at its NUL (edge case)', () => {
    expect([
      read([4, 0, 0, 0, 4, 0, 0, 0, 239, 187, 191, 97]),
      read([4, 0, 0, 0, 4, 0, 0, 0, 97, 0, 255, 255]),
    ]).toEqual(['"a"', '"a"']);
  });
});
