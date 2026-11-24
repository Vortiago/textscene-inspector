import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant';
import { assignArray, assignDictionary, isSameContainerType, typedArray } from './typedContainer';

const int = (value: bigint) => variant('INT', value);
const INT_TYPE = { type: 2, className: '' };
const STRING_TYPE = { type: 4, className: '' };
const NODE_TYPE = { type: 24, className: 'Node' };

describe('assignArray', () => {
  it('converts each element to the element type', () => {
    expect(assignArray(variant('ARRAY', [variant('FLOAT', 1.5)]), INT_TYPE)).toEqual(
      typedArray([int(1n)], INT_TYPE)
    );
  });

  it('leaves the typed array empty when an element does not convert', () => {
    expect(assignArray(variant('ARRAY', [variant('STRING', 'a')]), INT_TYPE)).toEqual(
      typedArray([], INT_TYPE)
    );
  });

  it('takes null objects into an array of a subclass', () => {
    const nodes = assignArray(variant('ARRAY', [variant('NIL', null)]), NODE_TYPE);
    expect(assignArray(nodes, { type: 24, className: 'Object' }).value).toHaveLength(1);
  });

  it('refuses the elements of an array of an unrelated class', () => {
    const nodes = assignArray(variant('ARRAY', [variant('NIL', null)]), NODE_TYPE);
    expect(assignArray(nodes, { type: 24, className: 'Resource' }).value).toEqual([]);
  });
});

describe('assignDictionary', () => {
  it('empties the dictionary when a value does not convert', () => {
    const base = variant('DICTIONARY', [{ key: int(1n), value: int(2n) }]);
    expect(assignDictionary(base, INT_TYPE, STRING_TYPE).value).toEqual([]);
  });

  it('keeps a key type and leaves the value untyped for NIL', () => {
    const base = variant('DICTIONARY', [{ key: int(1n), value: int(2n) }]);
    const typed = assignDictionary(base, INT_TYPE, { type: 0, className: '' });
    expect([typed.keyType, typed.valueType]).toEqual([INT_TYPE, undefined]);
  });

  it('leaves both types out for NIL', () => {
    const NIL_TYPE = { type: 0, className: '' };
    expect(assignDictionary(variant('DICTIONARY', []), NIL_TYPE, NIL_TYPE)).toEqual(
      variant('DICTIONARY', [])
    );
  });
});

describe('isSameContainerType', () => {
  it('holds an absent type and NIL alike', () => {
    expect(isSameContainerType(undefined, undefined)).toBe(true);
  });

  it('tells two class names apart', () => {
    expect(isSameContainerType(NODE_TYPE, { type: 24, className: 'Object' })).toBe(false);
  });
});
