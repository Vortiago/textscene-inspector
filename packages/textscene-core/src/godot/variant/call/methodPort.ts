import type { GlobalRandom } from '../utility/globalRandom.js';
import type { CastArgument, CppParameter } from '../utility/utilityArguments.js';
import type { CallableValue, Variant, VariantTypeName } from '../value/variant.js';

/** A C++ parameter of a builtin method: a scalar as the utility casters read it, or a Variant type. */
export type MethodParameter = CppParameter | VariantTypeName;

/** What a call leaves: the value, which a refused argument also leaves, and whether Godot calls it valid. */
export interface MethodResult {
  readonly value: Variant;
  readonly isValid: boolean;
}

/** What a method reads beyond its base and arguments. */
export interface MethodContext {
  readonly random: GlobalRandom;
  /** `Callable::callp` (callable.cpp:43). */
  readonly callp: (callable: CallableValue, args: readonly Variant[]) => MethodResult;
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

/** A vararg builtin of `bind_custom` (variant_call.cpp:1985): it reads the arguments as given. */
export type VarargPort = (base: Variant, args: readonly Variant[], context: MethodContext) => MethodResult;
