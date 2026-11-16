import { stringToFloat } from '../../string/strtod.js';
import { doubleToInt32, doubleToUint64, int64ToFloat32, wrapInt32 } from '../cInteger.js';
import { castVariant, canConvertStrict } from '../construct/variantCast.js';
import type { Variant, VariantTypeName } from '../value/variant.js';

/** The C++ parameter types of the utility functions a FUNCBINDR binding checks and casts. */
export type CppParameter =
  | 'double'
  | 'float'
  | 'int32_t'
  | 'int64_t'
  | 'uint64_t'
  | 'Error'
  | 'Variant::Type'
  | 'String'
  | 'PackedByteArray'
  | 'Variant';

/** The value a caster gives: a number, an int64 or uint64 as a bigint, a text, or the Variant itself. */
export type CastArgument = number | bigint | string | Variant;

// GetTypeInfo<T>::VARIANT_TYPE: an enum is an INT, and a Variant parameter takes any type as NIL.
const CHECKED_TYPE: Readonly<Record<CppParameter, VariantTypeName>> = {
  double: 'FLOAT',
  float: 'FLOAT',
  int32_t: 'INT',
  int64_t: 'INT',
  uint64_t: 'INT',
  Error: 'INT',
  'Variant::Type': 'INT',
  String: 'STRING',
  PackedByteArray: 'PACKED_BYTE_ARRAY',
  Variant: 'NIL',
};

export const isCppParameter = (name: string): name is CppParameter => Object.hasOwn(CHECKED_TYPE, name);

/** The type `VariantCasterAndValidate` checks a parameter of `parameter` against (binder_common.h:172). */
export const checkedType = (parameter: CppParameter): VariantTypeName => CHECKED_TYPE[parameter];

/** Whether `Variant::can_convert_strict` lets `argument` through to a parameter of `parameter`. */
export const isAccepted = (argument: Variant, parameter: CppParameter): boolean =>
  canConvertStrict(argument.type, checkedType(parameter));

// `_to_float<float>` (variant.h:361): an int64 rounds once to a float, other sources through a double.
function toFloat32(argument: Variant): number {
  if (argument.type === 'INT') return int64ToFloat32(argument.value);
  if (argument.type === 'STRING') return Math.fround(stringToFloat(argument.value));
  return Math.fround(castVariant(argument, 'FLOAT').value as number);
}

// `_to_int<int32_t>`: a double through the int32 cast, every other source through its int64 bits.
function toInt32(argument: Variant): number {
  if (argument.type === 'FLOAT') return doubleToInt32(argument.value);
  return wrapInt32(castVariant(argument, 'INT').value as bigint);
}

// `_to_int<uint64_t>`: a double through the unsigned cast, every other source through its int64 bits.
function toUint64(argument: Variant): bigint {
  if (argument.type === 'FLOAT') return doubleToUint64(argument.value);
  return BigInt.asUintN(64, castVariant(argument, 'INT').value as bigint);
}

/** `VariantCaster<T>::cast`: the value the function runs with, also for an argument the check refused. */
export function castArgument(argument: Variant, parameter: CppParameter): CastArgument {
  switch (parameter) {
    case 'double':
      return castVariant(argument, 'FLOAT').value as number;
    case 'float':
      return toFloat32(argument);
    case 'int32_t':
      return toInt32(argument);
    case 'int64_t':
      return castVariant(argument, 'INT').value as bigint;
    case 'uint64_t':
      return toUint64(argument);
    case 'Error':
    case 'Variant::Type':
      return wrapInt32(castVariant(argument, 'INT').value as bigint);
    case 'String':
      return castVariant(argument, 'STRING').value as string;
    case 'PackedByteArray':
      return castVariant(argument, 'PACKED_BYTE_ARRAY');
    case 'Variant':
      return argument;
  }
}
