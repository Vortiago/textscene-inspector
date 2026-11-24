import { describe, expect, it } from 'vitest';
import { utilityDeclarations, utilityFunctions } from './readUtilities.mjs';

const source = (body) => `void Variant::_register_variant_utility_functions() {
${body}
}
`;

const HEADER = `struct VariantUtilityFunctions {
	static double atan2(double y, double x);
	static Variant max(const Variant **p_args, int p_argcount, Callable::CallError &r_error);
	static void _print_verbose(const Variant **p_args, int p_arg_count, Callable::CallError &r_error);
	static uint64_t rid_allocate_id();
	static int64_t _typeof(const Variant &obj);
	static Variant floor(const Variant &x, Callable::CallError &r_error);
	static double cubic(double from,
			double to_t);
};`;

describe('utilityDeclarations', () => {
  it('reads each parameter as its bare C++ type, across line breaks', () => {
    const declarations = utilityDeclarations(HEADER);
    expect(declarations.get('_typeof')).toEqual(['Variant']);
    expect(declarations.get('cubic')).toEqual(['double', 'double']);
    expect(declarations.get('rid_allocate_id')).toEqual([]);
  });
});

describe('utilityFunctions', () => {
  it('reads a function as its name, count, call kind and typed parameters', () => {
    const rows = utilityFunctions(
      source(`	FUNCBINDR(atan2, sarray("y", "x"), Variant::UTILITY_FUNC_TYPE_MATH);
	FUNCBINDVR(floor, sarray("x"), Variant::UTILITY_FUNC_TYPE_MATH);
	FUNCBINDVARARG(max, sarray(), Variant::UTILITY_FUNC_TYPE_MATH);
	FUNCBINDVARARGV_CNAME(print_verbose, _print_verbose, sarray(), Variant::UTILITY_FUNC_TYPE_GENERAL);
	FUNCBINDR(rid_allocate_id, Vector<String>(), Variant::UTILITY_FUNC_TYPE_GENERAL);`),
      HEADER
    );
    expect(rows).toEqual([
      { name: 'atan2', argumentCount: 2, isVararg: false, kind: 'typed', parameters: ['double', 'double'] },
      { name: 'floor', argumentCount: 1, isVararg: false, kind: 'variant', parameters: [] },
      { name: 'max', argumentCount: 0, isVararg: true, kind: 'vararg', parameters: [] },
      { name: 'print_verbose', argumentCount: 0, isVararg: true, kind: 'vararg', parameters: [] },
      { name: 'rid_allocate_id', argumentCount: 0, isVararg: false, kind: 'typed', parameters: [] },
    ]);
  });

  it('registers a function named with a leading underscore without it, as register_utility_function does', () => {
    const rows = utilityFunctions(
      source('	FUNCBINDR(_typeof, sarray("variable"), Variant::UTILITY_FUNC_TYPE_GENERAL);'),
      HEADER
    );
    expect(rows[0].name).toBe('typeof');
  });

  it('refuses a statement it does not understand, so no function drops in silence', () => {
    expect(() => utilityFunctions(source('\tOTHER(x);'), HEADER)).toThrow(/OTHER/);
  });
});
