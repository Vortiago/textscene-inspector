import { describe, expect, it } from 'vitest';
import { NIL, variant } from '../value/variant';
import { getNamed, variantGet } from './variantGet';

const text = (value: string) => variant('STRING', value);
const int = (value: number) => variant('INT', BigInt(value));

describe('variantGet', () => {
  it('reads a Dictionary entry by a String key given as a StringName', () => {
    const dictionary = variant('DICTIONARY', [{ key: text('a'), value: int(1) }]);
    expect(variantGet(dictionary, variant('STRING_NAME', 'a'))).toEqual({ value: int(1), isValid: true });
  });

  it('truncates a float index toward zero', () => {
    const array = variant('ARRAY', [int(1), int(2)]);
    expect(variantGet(array, variant('FLOAT', 1.9))).toEqual({ value: int(2), isValid: true });
  });

  it('counts a negative index from the end of a String', () => {
    expect(variantGet(text('abc'), int(-1)).value).toEqual(text('c'));
  });

  it('refuses a negative index on a Vector2, which has a fixed size', () => {
    expect(variantGet(variant('VECTOR2', { x: 1, y: 2 }), int(-1)).isValid).toBe(false);
  });
});

describe('getNamed', () => {
  it('leaves the text Godot leaves when the base is a null Object', () => {
    expect(getNamed(variant('OBJECT', null), 'x')).toEqual({
      value: text('Instance base is null.'),
      isValid: false,
    });
  });

  it('reads a builtin method as a Callable bound to its base', () => {
    const base = variant('VECTOR2', { x: 1, y: 2 });
    expect(getNamed(base, 'length').value).toEqual(variant('CALLABLE', { method: 'length', base }));
  });

  it('fails on a Dictionary method name, which only names an entry there', () => {
    expect(getNamed(variant('DICTIONARY', []), 'size')).toEqual({ value: NIL, isValid: false });
  });
});
