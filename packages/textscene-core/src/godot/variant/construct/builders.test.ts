import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import { buildFromCast } from './builders.js';

describe('buildFromCast', () => {
  it('casts a single argument of a type that converts strictly', () => {
    expect(buildFromCast('FLOAT', ['INT'], [variant('INT', 2n)])).toEqual(variant('FLOAT', 2));
  });

  it('builds an opaque colour from three floats', () => {
    const args = [variant('FLOAT', 1), variant('FLOAT', 0.5), variant('FLOAT', 0)];
    expect(buildFromCast('COLOR', ['FLOAT', 'FLOAT', 'FLOAT'], args)).toEqual(
      variant('COLOR', { r: 1, g: 0.5, b: 0, a: 1 })
    );
  });

  it('throws on a registration it has no builder for', () => {
    expect(() => buildFromCast('VECTOR2', ['STRING', 'STRING'], [])).toThrow(
      'expected a ported constructor, got VECTOR2(STRING, STRING)'
    );
  });
});
