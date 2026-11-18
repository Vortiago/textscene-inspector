import { describe, expect, it } from 'vitest';
import { NIL, variant } from '../value/variant';
import { NIL_RESULT, type MethodContext } from './methodPort';
import { SIGNAL_METHODS, SIGNAL_VARARG_METHODS } from './signalMethods';

const NO_CONTEXT = {} as MethodContext;
const signal = (name: string) => variant('SIGNAL', name);

describe('SIGNAL_METHODS', () => {
  it('reads the name of the Signal', () => {
    expect(SIGNAL_METHODS.get_name!.run(signal('a'), [], NO_CONTEXT)).toEqual(variant('STRING_NAME', 'a'));
  });

  it('is null for a Signal of no name', () => {
    expect(SIGNAL_METHODS.is_null!.run(signal(''), [], NO_CONTEXT)).toEqual(variant('BOOL', true));
  });

  it('refuses connect as ERR_UNCONFIGURED, as the Signal has no Object', () => {
    expect(SIGNAL_METHODS.connect!.run(signal('a'), [NIL, 0], NO_CONTEXT)).toEqual(variant('INT', 3n));
  });
});

describe('SIGNAL_VARARG_METHODS', () => {
  it('emits to nobody and gives a valid null', () => {
    expect(SIGNAL_VARARG_METHODS.emit!(signal('a'), [], NO_CONTEXT)).toBe(NIL_RESULT);
  });
});
