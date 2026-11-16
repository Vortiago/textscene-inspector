import { identityCompare } from '../compare.js';
import { castVariant } from '../construct/variantCast.js';
import { ERROR_NAMES } from '../registrations.generated.js';
import { stringify } from '../stringify.js';
import { variantHash } from '../variantHash.js';
import { NIL, variant, type Variant, type VariantTypeName } from '../value/variant.js';
import { VARIANT_TYPE, variantTypeName } from '../variantType.js';
import { UnportableUtility } from './unportableUtility.js';
import type { TypedFunction, VariantFunction } from './utilityFunction.js';

const TYPE_BY_NUMBER = Object.keys(VARIANT_TYPE) as VariantTypeName[];

// `type_convert` (variant_utility.cpp:848): `VARIANT_MAX` and any other number keep the value.
function typeConvert(value: Variant, type: number): Variant {
  if (type === 0) return NIL;
  const target = TYPE_BY_NUMBER[type];
  return target ? castVariant(value, target) : value;
}

const text = (value: string) => variant('STRING', value);

// An object id is the editor's own: only 0, the null object, means the same in every run.
function nullObjectId(id: bigint, call: string): void {
  if (id !== 0n)
    throw new UnportableUtility(`${call}(${id}) asks for an object of the running editor by its id`);
}

export const GENERAL_TYPED: Readonly<Record<string, TypedFunction>> = {
  typeof: ([value]) => variant('INT', BigInt(VARIANT_TYPE[(value as Variant).type])),
  type_convert: ([value, type]) => typeConvert(value as Variant, type as number),
  error_string: ([error]) => text(ERROR_NAMES[error as number] ?? '(invalid error code)'),
  type_string: ([type]) => text(variantTypeName(type as number) ?? '<invalid type>'),
  is_same: ([a, b]) => variant('BOOL', identityCompare(a as Variant, b as Variant)),
  instance_from_id: ([id]) => {
    nullObjectId(id as bigint, 'instance_from_id');
    return variant('OBJECT', null);
  },
  is_instance_id_valid: ([id]) => {
    nullObjectId(id as bigint, 'is_instance_id_valid');
    return variant('BOOL', false);
  },
  is_instance_valid: () => variant('BOOL', false),
  rid_allocate_id: () => {
    throw new UnportableUtility('rid_allocate_id() counts the RIDs the running editor has made');
  },
  rid_from_int64: ([id]) => variant('RID', id as bigint),
  hash: ([value]) => variant('INT', BigInt(variantHash(value as Variant))),
};

const joined = (args: readonly Variant[]) => text(args.map(stringify).join(''));

// Nil with no error: `push_error` sets TOO_FEW, then clears it after printing (variant_utility.cpp:1025).
const printed: VariantFunction = () => ({ value: NIL });

export const GENERAL_VARARG: Readonly<Record<string, VariantFunction>> = {
  str: (args) =>
    args.length < 1
      ? { value: text(''), error: { error: 'TOO_FEW_ARGUMENTS', expected: 1 } }
      : { value: joined(args) },
  print: printed,
  print_rich: printed,
  printerr: printed,
  printt: printed,
  prints: printed,
  printraw: printed,
  print_verbose: printed,
  push_error: printed,
  push_warning: printed,
};
