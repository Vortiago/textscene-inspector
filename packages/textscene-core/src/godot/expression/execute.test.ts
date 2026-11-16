import { describe, expect, it } from 'vitest';
import { UnsupportedObject } from '../variant/objects/makeObject.js';
import { variant } from '../variant/value/variant.js';
import { runExpression, UnportedExpression } from './execute.js';
import { UnportableUtility } from '../variant/utility/unportableUtility.js';

// Each expected answer is Godot 4.6.3's Expression of the same text.
describe('runExpression', () => {
  it.each(['toString', 'constructor', '__proto__'])(
    'reads %s as a name, which needs self, as Godot 4.6.3 does',
    (name) => {
      expect(runExpression(name)).toMatchObject({
        executeError: "self can't be used because instance is null (not passed)",
      });
    }
  );

  it('multiplies before it adds', () => {
    expect(runExpression('1 + 2 * 3')).toEqual({ value: variant('INT', 7n) });
  });

  it('groups ** from the left', () => {
    expect(runExpression('2 ** 3 ** 2')).toEqual({ value: variant('INT', 64n) });
  });

  it('negates after **', () => {
    expect(runExpression('-2 ** 2')).toEqual({ value: variant('INT', -4n) });
  });

  it('gives the sign of the dividend to %', () => {
    expect(runExpression('7 % -3')).toEqual({ value: variant('INT', 1n) });
  });

  it('divides a float by zero to infinity', () => {
    expect(runExpression('1.0 / 0')).toEqual({ value: variant('FLOAT', Infinity) });
  });

  it('constructs a Vector2 and scales it', () => {
    expect(runExpression('Vector2(1, 2) * 2')).toEqual({ value: variant('VECTOR2', { x: 2, y: 4 }) });
  });

  it('fails an int divided by zero at execution', () => {
    expect(runExpression('1 / 0')).toEqual({
      executeError: 'Invalid operands to operator /, int and int.',
      value: variant('STRING', 'Division by zero error'),
    });
  });

  it('fails a String plus an int at execution', () => {
    expect(runExpression('"a" + 1')).toEqual({
      executeError: 'Invalid operands to operator +, String and int.',
      value: variant('NIL', null),
    });
  });

  it('leaves Nil when a node below the root fails', () => {
    expect(runExpression('(1 / 0) + 1')).toMatchObject({ value: variant('NIL', null) });
  });

  it('gives the parse error of a missing operand', () => {
    expect(runExpression('1 +')).toEqual({ parseError: 'Expected expression.' });
  });

  it('refuses a method call it has not ported', () => {
    expect(() => runExpression('PackedByteArray().compress()')).toThrow(UnportedExpression);
  });

  it('refuses an expression that makes an object', () => {
    expect(() => runExpression('weakref(null)')).toThrow(UnsupportedObject);
  });

  it('calls a utility function', () => {
    expect(runExpression('abs(-2)')).toEqual({ value: variant('INT', 2n) });
  });

  it('keeps the value a refused utility call returns, with the call error', () => {
    expect(runExpression('floor("x")')).toEqual({
      executeError: "Builtin call failed: 'floor': Cannot convert argument 1 from String to Nil",
      value: variant(
        'STRING',
        'Argument "x" must be "int", "float", "Vector2", "Vector2i", "Vector3", "Vector3i", "Vector4", or "Vector4i".'
      ),
    });
  });

  it('refuses a random draw before a seed', () => {
    expect(() => runExpression('randi()')).toThrow(UnportableUtility);
  });
});
