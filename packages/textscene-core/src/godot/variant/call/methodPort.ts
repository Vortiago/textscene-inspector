import type { Variant, VariantTypeName } from '../value/variant.js';
import type { CastArgument, CppParameter } from '../utility/utilityArguments.js';

/** A C++ parameter of a builtin method: a scalar as the utility casters read it, or a Variant type. */
export type MethodParameter = CppParameter | VariantTypeName;

/** A builtin method: its C++ parameters, and its body on the base value and the cast arguments. */
export interface MethodPort {
  readonly parameters: readonly MethodParameter[];
  readonly run: (base: Variant, args: readonly CastArgument[]) => Variant;
}

export const methodPort = (
  parameters: readonly MethodParameter[],
  run: (base: Variant, args: readonly CastArgument[]) => Variant
): MethodPort => ({ parameters, run });
