import { describe, expect, it } from 'vitest';
import { utilityFunctions } from './readUtilities.mjs';

const source = (body) => `void Variant::_register_variant_utility_functions() {
${body}
}
`;

describe('utilityFunctions', () => {
  it('reads a function as its name, argument count and whether it takes any count', () => {
    const rows = utilityFunctions(
      source(`	FUNCBINDR(atan2, sarray("y", "x"), Variant::UTILITY_FUNC_TYPE_MATH);
	FUNCBINDVARARGS(max, sarray(), Variant::UTILITY_FUNC_TYPE_MATH);
	FUNCBINDVARARGV_CNAME(print_verbose, _print_verbose, sarray(), Variant::UTILITY_FUNC_TYPE_GENERAL);
	FUNCBINDR(rid_allocate_id, Vector<String>(), Variant::UTILITY_FUNC_TYPE_GENERAL);`)
    );
    expect(rows).toEqual([
      { name: 'atan2', argumentCount: 2, isVararg: false },
      { name: 'max', argumentCount: 0, isVararg: true },
      { name: 'print_verbose', argumentCount: 0, isVararg: true },
      { name: 'rid_allocate_id', argumentCount: 0, isVararg: false },
    ]);
  });

  it('refuses a statement it does not understand, so no function drops in silence', () => {
    expect(() => utilityFunctions(source('\tOTHER(x);'))).toThrow(/OTHER/);
  });
});
