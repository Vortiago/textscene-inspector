import type { GlobalRandom } from '../utility/globalRandom.js';
import type { CastArgument, CppParameter } from '../utility/utilityArguments.js';
import type { CallableValue, Variant, VariantTypeName } from '../value/variant.js';

/** A C++ parameter of a builtin method: a scalar as the utility casters read it, or a Variant type. */
export type MethodParameter = CppParameter | VariantTypeName;

/** What a method reads beyond its base and arguments. */
export interface MethodContext {
  readonly random: GlobalRandom;
  /** `Callable::callp`: the value the call returns, or nothing on a call error. */
  readonly callCallable: (callable: CallableValue, args: readonly Variant[]) => Variant | undefined;
}

/** A builtin method: its C++ parameters, and its body on the base value and the cast arguments. */
export interface MethodPort {
  readonly parameters: readonly MethodParameter[];
  readonly run: (base: Variant, args: readonly CastArgument[], context: MethodContext) => Variant;
}

export const methodPort = (
  parameters: readonly MethodParameter[],
  run: (base: Variant, args: readonly CastArgument[], context: MethodContext) => Variant
): MethodPort => ({ parameters, run });
