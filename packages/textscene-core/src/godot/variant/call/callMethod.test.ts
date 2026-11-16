import { describe, expect, it } from 'vitest';
import { NIL, variant, type Variant } from '../value/variant';
import { variantCallable } from '../variantHash';
import { utilityHost } from '../utility/utilityHost';
import { callMethod } from './callMethod';

const vector2 = (x: number, y: number) => variant('VECTOR2', { x, y });

describe('callMethod', () => {
  it('runs a method of a ported type and calls it valid', () => {
    expect(callMethod(vector2(3, 4), 'length', [], utilityHost())).toEqual({
      value: variant('FLOAT', 5),
      isValid: true,
    });
  });

  it('fills a missing argument from the default text of the extension API', () => {
    // limit_length(length = 1.0) of a vector of length 5.
    expect(callMethod(vector2(3, 4), 'limit_length', [], utilityHost())).toEqual({
      value: vector2(Math.fround(0.6), Math.fround(0.8)),
      isValid: true,
    });
  });

  it('runs a method on an argument it refuses, cast to the parameter type, and calls it invalid', () => {
    // binder_common.h:172: the String casts to Vector2(), so the dot product is 0.
    expect(callMethod(vector2(1, 2), 'dot', [variant('STRING', 'a')], utilityHost())).toEqual({
      value: variant('FLOAT', 0),
      isValid: false,
    });
  });

  it('takes an argument that converts strictly, such as a Vector2i for a Vector2', () => {
    expect(callMethod(vector2(1, 2), 'dot', [variant('VECTOR2I', { x: 3, y: 4 })], utilityHost())).toEqual({
      value: variant('FLOAT', 11),
      isValid: true,
    });
  });

  it('runs nothing and leaves null for too many or too few arguments', () => {
    expect(callMethod(vector2(3, 4), 'length', [vector2(1, 1)], utilityHost())).toEqual({
      value: NIL,
      isValid: false,
    });
    expect(callMethod(vector2(3, 4), 'dot', [], utilityHost())).toEqual({ value: NIL, isValid: false });
  });

  it('leaves null for a name that is not a method of the type', () => {
    expect(callMethod(vector2(3, 4), 'nope', [], utilityHost())).toEqual({ value: NIL, isValid: false });
  });

  it('leaves null for a method of the null Object', () => {
    expect(callMethod(variant('OBJECT', null), 'free', [], utilityHost())).toEqual({
      value: NIL,
      isValid: false,
    });
  });

  it('gives nothing for a method with no port yet, so the caller refuses it', () => {
    expect(callMethod(variant('PACKED_BYTE_ARRAY', []), 'compress', [], utilityHost())).toBeUndefined();
  });
});

describe('a Callable call', () => {
  const has = variantCallable(variant('ARRAY', [variant('INT', 3n)]), 'has');
  const call = (callable: Variant, args: Variant[]) => callMethod(callable, 'call', args, utilityHost());
  const bound = (callable: Variant, args: Variant[]) =>
    callMethod(callable, 'bind', args, utilityHost())!.value;
  const unbound = (callable: Variant, count: bigint) =>
    callMethod(callable, 'unbind', [variant('INT', count)], utilityHost())!.value;

  it('puts the bound values after the arguments', () => {
    expect(call(bound(has, [variant('INT', 3n)]), [])).toEqual({
      value: variant('BOOL', true),
      isValid: true,
    });
  });

  it('drops the last arguments of an unbind', () => {
    const args = [variant('INT', 3n), variant('INT', 9n)];
    expect(call(unbound(has, 1n), args)).toEqual({ value: variant('BOOL', true), isValid: true });
  });

  it('is a call error for an unbind given fewer arguments than it drops', () => {
    expect(call(unbound(has, 2n), [variant('INT', 3n)])).toEqual({ value: NIL, isValid: false });
  });

  it('is a call error for the null Callable', () => {
    expect(call(variant('CALLABLE', { kind: 'standard', method: '' }), [])).toEqual({
      value: NIL,
      isValid: false,
    });
  });
});
