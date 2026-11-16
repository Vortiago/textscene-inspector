import { variantTypeNameOf } from '../variantType.js';
import type { Variant, VariantTypeName } from '../value/variant.js';

/** `Callable::CallError` as the utility functions set it. */
export type CallError =
  | { readonly error: 'INVALID_ARGUMENT'; readonly argument: number; readonly expected: VariantTypeName }
  | { readonly error: 'TOO_FEW_ARGUMENTS' | 'TOO_MANY_ARGUMENTS'; readonly expected: number };

/** What a call leaves: the `r_ret` it wrote, which a failed call also writes, and its error. */
export interface UtilityResult {
  readonly value: Variant;
  readonly error?: CallError;
}

export const invalidArgument = (argument: number, expected: VariantTypeName): CallError => ({
  error: 'INVALID_ARGUMENT',
  argument,
  expected,
});

/** `Variant::get_call_error_text` (variant.cpp:3496) for a call of `name` with no base object. */
export function callErrorText(name: string, args: readonly Variant[], error: CallError): string {
  if (error.error === 'INVALID_ARGUMENT') {
    const found = variantTypeNameOf(args[error.argument]!.type);
    return `'${name}': Cannot convert argument ${error.argument + 1} from ${found} to ${variantTypeNameOf(error.expected)}`;
  }
  return `'${name}': Method expected ${error.expected} argument(s), but called with ${args.length}`;
}
