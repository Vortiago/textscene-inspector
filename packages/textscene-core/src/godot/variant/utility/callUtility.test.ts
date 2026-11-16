import { describe, expect, it } from 'vitest';
import { UnsupportedObject } from '../objects/makeObject.js';
import { NIL, variant } from '../value/variant.js';
import { callErrorText } from './callError.js';
import { callUtility } from './callUtility.js';
import { utilityHost } from './utilityHost.js';

const int = (value: bigint) => variant('INT', value);
const text = (value: string) => variant('STRING', value);
const call = (name: string, ...args: Parameters<typeof callUtility>[1]) =>
  callUtility(name, args, utilityHost());

describe('callUtility', () => {
  it('gives nothing for a name it does not port', () => {
    expect(call('no_such_function')).toBeUndefined();
  });

  it('refuses a weakref of a value that is not an object, as Godot does', () => {
    expect(call('weakref', int(1n))).toEqual({
      value: NIL,
      error: { error: 'INVALID_ARGUMENT', argument: 0, expected: 'OBJECT' },
    });
  });

  it('stops a weakref of null, as it makes a WeakRef object', () => {
    expect(() => call('weakref', NIL)).toThrow(UnsupportedObject);
  });

  it('refuses a wrong argument count of a function that takes a fixed one', () => {
    expect(call('abs')).toEqual({ value: NIL, error: { error: 'TOO_FEW_ARGUMENTS', expected: 1 } });
    expect(call('atan2', int(1n), int(2n), int(3n))).toEqual({
      value: NIL,
      error: { error: 'TOO_MANY_ARGUMENTS', expected: 2 },
    });
  });

  it('reports the leftmost refused argument, as the right-to-left casts leave it', () => {
    const args = [text('a'), text('b')];
    const result = callUtility('atan2', args, utilityHost())!;
    expect(callErrorText('atan2', args, result.error!)).toBe(
      "'atan2': Cannot convert argument 1 from String to float"
    );
  });

  it('still runs a refused typed call on its cast arguments', () => {
    expect(call('absf', text('-2.5'))).toEqual({
      value: variant('FLOAT', 2.5),
      error: { error: 'INVALID_ARGUMENT', argument: 0, expected: 'FLOAT' },
    });
  });

  it('casts a double argument from an int', () => {
    expect(call('sqrt', int(16n))).toEqual({ value: variant('FLOAT', 4) });
  });

  it('draws from the generator a seed set in an earlier call', () => {
    const host = utilityHost();
    callUtility('seed', [int(5n)], host);
    expect(callUtility('randi', [], host)).toEqual({ value: int(3066015881n) });
  });
});
