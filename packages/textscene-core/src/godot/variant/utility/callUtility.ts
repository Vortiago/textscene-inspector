import { UTILITY_FUNCTIONS } from '../registrations.generated.js';
import { NIL, type Variant } from '../value/variant.js';
import { invalidArgument, type CallError, type UtilityResult } from './callError.js';
import { GENERAL_TYPED, GENERAL_VARARG, GENERAL_VARIANT } from './generalUtilities.js';
import { RANDOM_UTILITIES } from './randomUtilities.js';
import { SCALAR_MATH } from './scalarMath.js';
import { castArgument, checkedType, isAccepted, type CppParameter } from './utilityArguments.js';
import type { TypedFunction, VariantFunction } from './utilityFunction.js';
import type { UtilityHost } from './utilityHost.js';
import { VARIANT_MATH } from './variantMath.js';

interface Registration {
  readonly argumentCount: number;
  readonly isVararg: boolean;
  readonly parameters: readonly CppParameter[];
}

const REGISTRATIONS: ReadonlyMap<string, Registration> = new Map(
  UTILITY_FUNCTIONS.map(([name, argumentCount, isVararg, , parameters]) => [
    name,
    { argumentCount, isVararg, parameters: parameters as readonly CppParameter[] },
  ])
);

const TYPED: Readonly<Record<string, TypedFunction>> = {
  ...SCALAR_MATH,
  ...RANDOM_UTILITIES,
  ...GENERAL_TYPED,
};
const SELF_CHECKED: Readonly<Record<string, VariantFunction>> = {
  ...VARIANT_MATH,
  ...GENERAL_VARARG,
  ...GENERAL_VARIANT,
};

// `VariantCasterAndValidate` casts the arguments right to left, so the leftmost refused one is reported.
function firstRefused(args: readonly Variant[], parameters: readonly CppParameter[]): CallError | undefined {
  const index = parameters.findIndex((parameter, position) => !isAccepted(args[position]!, parameter));
  return index < 0 ? undefined : invalidArgument(index, checkedType(parameters[index]!));
}

function countError({ argumentCount, isVararg }: Registration, given: number): CallError | undefined {
  if (isVararg || given === argumentCount) return undefined;
  return {
    error: given < argumentCount ? 'TOO_FEW_ARGUMENTS' : 'TOO_MANY_ARGUMENTS',
    expected: argumentCount,
  };
}

/** Nothing for an unported `name`. A refused typed call still runs on its cast arguments, as in Godot. */
export function callUtility(
  name: string,
  args: readonly Variant[],
  host: UtilityHost
): UtilityResult | undefined {
  const registration = REGISTRATIONS.get(name);
  const typed = TYPED[name];
  const selfChecked = SELF_CHECKED[name];
  if (!registration || (!typed && !selfChecked)) return undefined;
  const wrongCount = countError(registration, args.length);
  if (wrongCount) return { value: NIL, error: wrongCount };
  if (selfChecked) return selfChecked(args, host);
  const { parameters } = registration;
  const value = typed!(
    parameters.map((parameter, index) => castArgument(args[index]!, parameter)),
    host
  );
  const error = firstRefused(args, parameters);
  return error ? { value, error } : { value };
}
