import { describe, expect, it } from 'vitest';
import { defaultValue } from '../value/defaultValue';
import { NIL, variant, type CallableValue, type Variant } from '../value/variant';
import { CALLABLE_METHODS, CALLABLE_VARARG_METHODS, isValidCallable } from './callableMethods';
import { FAILED, type MethodContext } from './methodPort';
import { variantCallable } from './variantCallable';

const failingContext = { callp: () => FAILED } as unknown as MethodContext;
const NO_CONTEXT = {} as MethodContext;

const has = variantCallable(variant('ARRAY', []), 'has');
const standard = variant('CALLABLE', { kind: 'standard', method: 'f' });
const bound = (callable: Variant, binds: readonly Variant[]) =>
  variant('CALLABLE', { kind: 'bind', callable: callable.value as CallableValue, binds });
const run = (method: string, base: Variant, args: readonly unknown[] = []) =>
  CALLABLE_METHODS[method]!.run(base, args as Variant[], NO_CONTEXT);

describe('isValidCallable', () => {
  it('is valid for a method of a builtin base', () => {
    expect(isValidCallable(has.value)).toBe(true);
  });

  it('is not valid for a standard Callable, which has no Object here', () => {
    expect(isValidCallable(standard.value as CallableValue)).toBe(false);
  });

  it('is not valid for a method its base does not have', () => {
    expect(isValidCallable({ kind: 'variant', method: 'nope', base: variant('INT', 1n), hash: 0 })).toBe(
      false
    );
  });

  it('is valid for a bind of a valid Callable', () => {
    expect(isValidCallable(bound(has, [NIL]).value as CallableValue)).toBe(true);
  });
});

describe('CALLABLE_METHODS', () => {
  it('creates a Callable of a builtin base with the hash of variantCallable', () => {
    const base = variant('ARRAY', []);
    expect(run('create', NIL, [base, variant('STRING_NAME', 'has')])).toEqual(has);
  });

  it('creates a null Callable for an empty method name', () => {
    expect(run('create', NIL, [variant('ARRAY', []), variant('STRING_NAME', '')])).toEqual(
      defaultValue('CALLABLE')
    );
  });

  it('creates a standard Callable for a null target', () => {
    expect(run('create', NIL, [NIL, variant('STRING_NAME', 'f')])).toEqual(standard);
  });

  it('gives the same Callable for bindv of an empty Array', () => {
    expect(run('bindv', has, [variant('ARRAY', [])])).toEqual(has);
  });

  it('gives the same Callable for unbind of 0', () => {
    expect(run('unbind', has, [0])).toEqual(has);
  });

  it('counts the arguments of a bind less its binds', () => {
    expect(run('get_argument_count', bound(has, [variant('INT', 1n)]))).toEqual(variant('INT', 0n));
  });

  it('counts no arguments for a standard Callable', () => {
    expect(run('get_argument_count', standard)).toEqual(variant('INT', 0n));
  });

  it('drops the call error in callv', () => {
    expect(CALLABLE_METHODS.callv!.run(has, [variant('ARRAY', [])], failingContext)).toBe(NIL);
  });
});

describe('CALLABLE_VARARG_METHODS', () => {
  it('fails every rpc, as no Callable here reaches a peer', () => {
    expect(CALLABLE_VARARG_METHODS.rpc!(has, [], NO_CONTEXT)).toBe(FAILED);
  });

  it('wraps the arguments of bind around the Callable', () => {
    expect(CALLABLE_VARARG_METHODS.bind!(has, [NIL], NO_CONTEXT)).toEqual({
      value: bound(has, [NIL]),
      isValid: true,
    });
  });
});
