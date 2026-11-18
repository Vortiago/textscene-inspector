import { describe, expect, it } from 'vitest';
import { strToVar } from './strToVar';
import { varToStr } from './varToStr';
import { canConvertStrict, castVariant } from './variantCast';
import { VARIANT_TYPE as T } from './variantType';

// Each expected value is what a Godot 4.6.3 setter of that type received, read back after `Object.set`.
const castText = (input: string, to: number) => varToStr(castVariant(strToVar(input), to));

describe('castVariant', () => {
  it('gives the default of the setter type for a value it cannot convert', () => {
    expect(castText('"text"', T.VECTOR3)).toBe('Vector3(0, 0, 0)');
    expect(castText('12', T.VECTOR3)).toBe('Vector3(0, 0, 0)');
    expect(castText('null', T.VECTOR3)).toBe('Vector3(0, 0, 0)');
  });

  it('converts within a vector family component by component', () => {
    expect(castText('Vector3i(4, 5, 6)', T.VECTOR3)).toBe('Vector3(4, 5, 6)');
    expect(castText('Vector3(1.9, -1.9, 0)', T.VECTOR3I)).toBe('Vector3i(1, -1, 0)');
  });

  it('booleanises a number and a string', () => {
    expect(castText('0.0', T.BOOL)).toBe('false');
    expect(castText('"false"', T.BOOL)).toBe('true');
  });

  it('stringifies a number for a String setter', () => {
    expect(castText('12', T.STRING)).toBe('"12"');
  });

  it('reads a Color from an HTML string and from a packed 0xRRGGBBAA integer', () => {
    expect(castText('"#ff0000"', T.COLOR)).toBe('Color(1, 0, 0, 1)');
    expect(castText(String(0x00ff00ff), T.COLOR)).toBe('Color(0, 1, 0, 1)');
  });

  it('turns a basis into the quaternion of its rotation', () => {
    expect(castText('Basis(0, -1, 0, 1, 0, 0, 0, 0, 1)', T.QUATERNION)).toBe(
      'Quaternion(0, 0, 0.70710677, 0.70710677)'
    );
  });
});

describe('canConvertStrict', () => {
  it('takes a value of the setter type and its strict sources as valid', () => {
    expect(canConvertStrict(T.VECTOR3, T.VECTOR3)).toBe(true);
    expect(canConvertStrict(T.VECTOR3I, T.VECTOR3)).toBe(true);
    expect(canConvertStrict(T.INT, T.BOOL)).toBe(true);
  });

  it('reports a string for a vector, and a string for a bool, as not valid', () => {
    expect(canConvertStrict(T.STRING, T.VECTOR3)).toBe(false);
    expect(canConvertStrict(T.STRING, T.BOOL)).toBe(false);
  });

  it('takes null only for an object', () => {
    expect(canConvertStrict(T.NIL, T.OBJECT)).toBe(true);
    expect(canConvertStrict(T.NIL, T.VECTOR3)).toBe(false);
  });
});
