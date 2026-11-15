/**
 * `Variant::evaluate` (variant_op.cpp:1041): the evaluator registered for the operator and the two
 * operand types, from Godot's own registration table. A pair with none is invalid.
 */

import { booleanize, cppEqual, isZero } from '../compare.js';
import { variantTypeOfCpp } from '../cppType.js';
import { OPERATOR_REGISTRATIONS } from '../registrations.generated.js';
import { variant, type Variant, type VariantTypeName } from '../value/variant.js';
import { VARIANT_TYPE } from '../variantType.js';
import {
  binaryArithmetic,
  bitwise,
  divideNonZero,
  moduloNonZero,
  negate,
  power,
  shift,
  xform,
  xformInverse,
} from './arithmetic.js';
import {
  addArrays,
  appendPacked,
  concatenate,
  format,
  isInArray,
  isInDictionary,
  isInPacked,
  isInString,
} from './containers.js';
import { compare, type Comparison } from './ordering.js';

export type VariantOperator = (typeof OPERATOR_REGISTRATIONS)[number][0];

interface Registration {
  readonly evaluator: string;
  readonly types: readonly string[];
}

const REGISTRY = new Map<string, Registration>(
  OPERATOR_REGISTRATIONS.map(([operator, left, right, evaluator, types]) => [
    `${operator} ${left} ${right}`,
    { evaluator: evaluator.replace(/^OperatorEvaluator/, ''), types },
  ])
);

const bool = (value: boolean) => variant('BOOL', value);

/** The result, or nothing for an invalid pair or an evaluator that sets `r_valid = false`. */
export function evaluateOperator(operator: VariantOperator, a: Variant, b: Variant): Variant | undefined {
  const registration = REGISTRY.get(`${operator} ${a.type} ${b.type}`);
  if (!registration) return undefined;
  return runEvaluator(registration, a, b);
}

/** `Variant::operator<` (variant.cpp:882): types order first, then OP_LESS, with no result as false. */
export function isVariantLess(a: Variant, b: Variant): boolean {
  if (a.type !== b.type) return VARIANT_TYPE[a.type] < VARIANT_TYPE[b.type];
  const result = evaluateOperator('OP_LESS', a, b);
  return result !== undefined && booleanize(result);
}

const LOGIC_CLASS = /^(Nil|Bool|Int|Float|Object)X(Nil|Bool|Int|Float|Object)(Or|And|Xor)$/;

// _operate_get_* (variant_op.h): a Nil or null Object is false, a number is true when not zero.
const truthOf = (value: Variant) =>
  value.type === 'NIL' || value.type === 'OBJECT'
    ? false
    : value.type === 'BOOL'
      ? value.value
      : value.value !== 0 && value.value !== 0n;

const LOGIC = {
  Or: (a: boolean, b: boolean) => a || b,
  And: (a: boolean, b: boolean) => a && b,
  Xor: (a: boolean, b: boolean) => a !== b,
};

function runEvaluator({ evaluator, types }: Registration, a: Variant, b: Variant): Variant | undefined {
  const logic = LOGIC_CLASS.exec(evaluator);
  if (logic) return bool(LOGIC[logic[3] as keyof typeof LOGIC](truthOf(a), truthOf(b)));
  const resultType = (): VariantTypeName => variantTypeOfCpp(types[0]!);
  switch (evaluator) {
    case 'Add':
      return binaryArithmetic('add', a, b);
    case 'Sub':
      return binaryArithmetic('subtract', a, b);
    case 'Mul':
      return binaryArithmetic('multiply', a, b);
    case 'Div':
      return binaryArithmetic('divide', a, b);
    case 'DivNZ':
      return divideNonZero(a, b);
    case 'ModNZ':
      return moduloNonZero(a, b);
    case 'Pow':
      return power(resultType(), a, b);
    case 'Neg':
      return negate(a);
    case 'Pos':
      return a;
    case 'XForm':
      return xform(a, b);
    case 'XFormInv':
      return xformInverse(a, b);
    case 'ShiftLeft':
      return shift('left', a.value as bigint, b.value as bigint);
    case 'ShiftRight':
      return shift('right', a.value as bigint, b.value as bigint);
    case 'BitAnd':
      return bitwise('and', a.value as bigint, b.value as bigint);
    case 'BitOr':
      return bitwise('or', a.value as bigint, b.value as bigint);
    case 'BitXor':
      return bitwise('xor', a.value as bigint, b.value as bigint);
    case 'BitNeg':
      return variant('INT', ~(a.value as bigint));
    case 'Equal':
      return bool(cppEqual(a, b));
    case 'NotEqual':
      return bool(!cppEqual(a, b));
    case 'Less':
    case 'LessEqual':
    case 'Greater':
    case 'GreaterEqual':
      return bool(compare(`OP_${COMPARISON[evaluator]}` as Comparison, a, b, isVariantLess));
    // Every Object an expression makes is null, so these compare null with null or with Nil.
    case 'EqualObject':
    case 'EqualObjectNil':
    case 'EqualNilObject':
    case 'AlwaysTrue':
      return bool(true);
    case 'NotEqualObject':
    case 'NotEqualObjectNil':
    case 'NotEqualNilObject':
    case 'AlwaysFalse':
      return bool(false);
    // `a == A()`, and for the scalars `!a`: both are `is_zero`.
    case 'Not':
    case 'NotBool':
    case 'NotInt':
    case 'NotFloat':
    case 'NotObject':
      return bool(isZero(a));
    case 'AddArray':
      return addArrays(a.value as readonly Variant[], b.value as readonly Variant[]);
    case 'AppendArray':
      return appendPacked(a, b);
    case 'StringConcat':
      return concatenate(a, b);
    case 'StringFormat':
      return format(a.value as string, b);
    case 'InStringFind':
      return bool(isInString(a.value as string, b.value as string));
    case 'InArrayFind':
    case 'InArrayFindNil':
    case 'InArrayFindObject':
      return bool(b.type === 'ARRAY' ? isInArray(a, b.value) : isInPacked(a, b));
    case 'InDictionaryHas':
    case 'InDictionaryHasNil':
    case 'InDictionaryHasObject':
      return bool(isInDictionary(a, b.value as never));
    // A null Object is no base: "Invalid base object for 'in'".
    case 'ObjectHasPropertyString':
    case 'ObjectHasPropertyStringName':
      return undefined;
    default:
      throw new Error(`expected a ported operator evaluator, got ${evaluator}`);
  }
}

const COMPARISON = {
  Less: 'LESS',
  LessEqual: 'LESS_EQUAL',
  Greater: 'GREATER',
  GreaterEqual: 'GREATER_EQUAL',
} as const;
