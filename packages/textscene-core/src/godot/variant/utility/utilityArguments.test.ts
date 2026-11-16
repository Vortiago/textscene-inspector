import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import { castArgument, isCppParameter } from './utilityArguments.js';

describe('isCppParameter', () => {
  it('knows a C++ parameter type and refuses a Variant type name', () => {
    expect(isCppParameter('int32_t')).toBe(true);
    expect(isCppParameter('VECTOR2')).toBe(false);
  });

  it('refuses a name only the object prototype has', () => {
    expect(isCppParameter('toString')).toBe(false);
  });
});

describe('castArgument to int32_t', () => {
  it('gives INT32_MIN for a float out of range, as the C cast does', () => {
    expect(castArgument(variant('FLOAT', 3e9), 'int32_t')).toBe(-2147483648);
  });

  it('keeps the low 32 bits of an int', () => {
    expect(castArgument(variant('INT', 4294967297n), 'int32_t')).toBe(1);
  });
});
