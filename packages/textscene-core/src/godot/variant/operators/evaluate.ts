import { booleanize, cppEqual, isZero } from '../compare.js';
import { variantTypeOfCpp } from '../cppType.js';
import { OPERATOR_REGISTRATIONS } from '../registrations.generated.js';
import { NIL, bool, variant, type Variant, type VariantOf, type VariantTypeName } from '../value/variant.js';
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
import { InvalidOperands, invalidWithText } from './invalidOperands.js';
import { compare, type Comparison } from './ordering.js';

export type VariantOperator = (typeof OPERATOR_REGISTRATIONS)[number][0];

interface Registration {
  readonly evaluator: string;
  readonly types: readonly string[];
  /** The logic of an `OperatorEvaluator<A>X<B><Or|And|Xor>`, read once. */
  readonly logic?: keyof typeof LOGIC;
}

/** Written only by `registrationOf`, on the first operator: most imports never evaluate one. */
let registry: Map<string, Registration> | undefined;

function registrationOf(operator: VariantOperator, a: Variant, b: Variant): Registration | undefined {
  registry ??= new Map(
    OPERATOR_REGISTRATIONS.map(([name, left, right, evaluator, types]) => {
      const stripped = evaluator.replace(/^OperatorEvaluator/, '');
      const logic = LOGIC_CLASS.exec(stripped)?.[3] as keyof typeof LOGIC | undefined;
      return [`${name} ${left} ${right}`, { evaluator: stripped, types, ...(logic && { logic }) }];
    })
  );
  return registry.get(`${operator} ${a.type} ${b.type}`);
}

/** `r_ret` and `r_valid`. A pair with no evaluator leaves Nil. */
export interface Evaluation {
  readonly value: Variant;
  readonly isValid: boolean;
}

export function evaluateOperator(operator: VariantOperator, a: Variant, b: Variant): Evaluation {
  const registration = registrationOf(operator, a, b);
  if (!registration) return { value: NIL, isValid: false };
  const result = runEvaluator(registration, a, b);
  if (result instanceof InvalidOperands) return { value: result.value, isValid: false };
  return { value: result, isValid: true };
}

/**
 * `Variant::operator<` (variant.cpp:882): types order first, then OP_LESS, with no result as false.
 *
 * @canonical Variant::operator<
 */
export function isVariantLess(a: Variant, b: Variant): boolean {
  if (a.type !== b.type) return VARIANT_TYPE[a.type] < VARIANT_TYPE[b.type];
  const { value, isValid } = evaluateOperator('OP_LESS', a, b);
  return isValid && booleanize(value);
}

/**
 * `_ArrayVariantSort` (array.cpp:688) and `_DictionaryVariantSort` (dictionary.cpp:259): OP_LESS alone.
 *
 * @canonical OP_LESS with an invalid result as false
 */
export function isOperatorLess(a: Variant, b: Variant): boolean {
  const { value, isValid } = evaluateOperator('OP_LESS', a, b);
  return isValid && booleanize(value);
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

const DIVISION_BY_ZERO = 'Division by zero error';
const MODULO_BY_ZERO = 'Modulo by zero error';
const NEGATIVE_SHIFT = 'Invalid operands for bit shifting. Only positive operands are supported.';

function runEvaluator(
  { evaluator, types, logic }: Registration,
  a: Variant,
  b: Variant
): Variant | InvalidOperands {
  if (logic) return bool(LOGIC[logic](truthOf(a), truthOf(b)));
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
      return divideNonZero(a, b) ?? invalidWithText(DIVISION_BY_ZERO);
    case 'ModNZ':
      return moduloNonZero(a, b) ?? invalidWithText(MODULO_BY_ZERO);
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
      return shift('left', a.value as bigint, b.value as bigint) ?? invalidWithText(NEGATIVE_SHIFT);
    case 'ShiftRight':
      return shift('right', a.value as bigint, b.value as bigint) ?? invalidWithText(NEGATIVE_SHIFT);
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
      return addArrays(a as VariantOf<'ARRAY'>, b as VariantOf<'ARRAY'>);
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
    // Every Object an expression makes is null, and a null Object is no base.
    case 'ObjectHasPropertyString':
    case 'ObjectHasPropertyStringName':
      return invalidWithText("Invalid base object for 'in'");
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
