import type { Decoders } from '../../io/compression/compression.js';
import type { GlobalRandom } from '../utility/globalRandom.js';
import type { CastArgument, CppParameter } from '../utility/utilityArguments.js';
import { NIL, type CallableValue, type Variant, type VariantTypeName } from '../value/variant.js';

/** A C++ parameter of a builtin method: a scalar as the utility casters read it, or a Variant type. */
export type MethodParameter = CppParameter | VariantTypeName;

/** What a call leaves: the value, which a refused argument also leaves, and whether Godot calls it valid. */
export interface MethodResult {
  readonly value: Variant;
  readonly isValid: boolean;
}

export const FAILED: MethodResult = { value: NIL, isValid: false };
export const NIL_RESULT: MethodResult = { value: NIL, isValid: true };

/** What a method reads beyond its base and arguments. */
export interface MethodContext {
  readonly random: GlobalRandom;
  readonly decoders?: Decoders;
  /** `Callable::callp` (callable.cpp:43). */
  readonly callp: (callable: CallableValue, args: readonly Variant[]) => MethodResult;
}

/** A builtin method: its C++ parameters, and its body on the base value and the cast arguments. */
export interface MethodPort {
  readonly parameters: readonly MethodParameter[];
  /** It may change a container base in place, which a bound Callable keeps (variant_callable.cpp:81). */
  readonly run: (base: Variant, args: readonly CastArgument[], context: MethodContext) => Variant;
}

export const methodPort = (
  parameters: readonly MethodParameter[],
  run: (base: Variant, args: readonly CastArgument[], context: MethodContext) => Variant
): MethodPort => ({ parameters, run });

/** A vararg builtin of `bind_custom` (variant_call.cpp:1985): it reads the arguments as given. */
export type VarargPort = (base: Variant, args: readonly Variant[], context: MethodContext) => MethodResult;
