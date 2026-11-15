import { describe, expect, it } from 'vitest';
import { constructorRegistrations } from './readConstructors.mjs';

const source = (body) => `void Variant::_register_variant_constructors() {
${body}
}
`;

describe('constructorRegistrations', () => {
  it('reads a constructor as its class, template types and argument names', () => {
    const rows = constructorRegistrations(
      source('\tadd_constructor<VariantConstructor<Vector2, double, double>>(sarray("x", "y"));')
    );
    expect(rows).toEqual([
      {
        constructor: 'VariantConstructor',
        types: ['Vector2', 'double', 'double'],
        arguments: ['x', 'y'],
        line: 2,
      },
    ]);
  });

  it('reads a constructor of no template types and no arguments', () => {
    const [row] = constructorRegistrations(source('\tadd_constructor<VariantConstructNoArgsNil>(sarray());'));
    expect([row?.constructor, row?.types, row?.arguments]).toEqual(['VariantConstructNoArgsNil', [], []]);
  });

  it('refuses a statement it does not understand, so no row drops in silence', () => {
    expect(() => constructorRegistrations(source('\tadd_other(1);'))).toThrow(/add_other/);
  });
});
