import { wrapf, wrapi } from '../../math/doubleMath.js';
import { lerp, round, sign, snapped } from '../../math/math.js';
import { doubleToInt64, wrapInt32 } from '../cInteger.js';
import { callMethod } from '../call/callMethod.js';
import { booleanize } from '../compare.js';
import { toDouble } from '../construct/variantCast.js';
import { evaluateOperator } from '../operators/evaluate.js';
import { isVectorType } from '../value/mathLayout.js';
import { NIL, variant, type Variant, type VariantTypeName } from '../value/variant.js';
import { invalidArgument, type UtilityResult } from './callError.js';
import type { VariantFunction } from './utilityFunction.js';
import type { UtilityHost } from './utilityHost.js';

const isScalar = (type: VariantTypeName) => type === 'INT' || type === 'FLOAT';
const isNumeric = (type: VariantTypeName) => isScalar(type) || isVectorType(type);

const NUMERIC_EXPECTED =
  'Argument "x" must be "int", "float", "Vector2", "Vector2i", "Vector3", "Vector3i", "Vector4", or "Vector4i".';
const STEP_EXPECTED = 'Argument "step" must be "int" or "float".';
const LERP_EXPECTED =
  'Argument "from" must be "int", "float", "Vector2", "Vector3", "Vector4", "Color", "Quaternion", "Basis", "Transform2D", or "Transform3D".';
// variant_utility.cpp:474: an int or a float takes `lerpf`, every other type its own method.
const LERP_METHOD: Readonly<Partial<Record<VariantTypeName, string>>> = {
  VECTOR2: 'lerp',
  VECTOR3: 'lerp',
  VECTOR4: 'lerp',
  QUATERNION: 'slerp',
  BASIS: 'slerp',
  COLOR: 'lerp',
  TRANSFORM2D: 'interpolate_with',
  TRANSFORM3D: 'interpolate_with',
};

const done = (value: Variant): UtilityResult => ({ value });
const refused = (argument: number, expected: VariantTypeName, value: Variant = NIL): UtilityResult => ({
  value,
  error: invalidArgument(argument, expected),
});

// Every method a utility function calls on a vector or a struct is ported, so the call returns a value.
const callOn = (base: Variant, method: string, args: readonly Variant[], host: UtilityHost) =>
  callMethod(base, method, args, host)!;

/** How one of floor, ceil, round, abs and sign treats an int and a float. A vector calls its own method. */
interface NumericRule {
  readonly method: string;
  readonly int: (x: bigint) => bigint;
  readonly float: (x: number) => number;
}

// An int vector has no floor, ceil or round method, and these return it as it is.
function numeric({ method, int, float }: NumericRule): VariantFunction {
  return ([x], host) => {
    if (x!.type === 'INT') return done(variant('INT', int(x!.value)));
    if (x!.type === 'FLOAT') return done(variant('FLOAT', float(x!.value)));
    if (!isVectorType(x!.type)) return refused(0, 'NIL', variant('STRING', NUMERIC_EXPECTED));
    const result = callOn(x!, method, [], host);
    return done(result.isValid ? result.value : x!);
  };
}

const unchanged = <T>(x: T) => x;

const snapVariant: VariantFunction = ([x, step], host) => {
  if (!isNumeric(x!.type)) return refused(0, 'NIL', variant('STRING', NUMERIC_EXPECTED));
  if (x!.type !== step!.type) {
    if (!isScalar(x!.type)) return refused(1, x!.type);
    if (!isScalar(step!.type)) return refused(1, 'NIL', variant('STRING', STEP_EXPECTED));
  }
  if (step!.type === 'INT')
    return done(variant('INT', doubleToInt64(snapped(toDouble(x!), Number(step!.value)))));
  if (step!.type === 'FLOAT') return done(variant('FLOAT', snapped(toDouble(x!), step!.value)));
  return done(callOn(x!, 'snapped', [step!], host).value);
};

const lerpVariant: VariantFunction = ([from, to, weight], host) => {
  const method = LERP_METHOD[from!.type];
  if (!method && !isScalar(from!.type)) return refused(0, 'NIL', variant('STRING', LERP_EXPECTED));
  if (from!.type !== to!.type) return refused(1, from!.type);
  const weightValue = toDouble(weight!);
  if (!method) return done(variant('FLOAT', lerp(toDouble(from!), toDouble(to!), weightValue)));
  return done(callOn(from!, method, [to!, variant('FLOAT', weightValue)], host).value);
};

// An int x with int bounds wraps through `(int)`, the int32 cast, and any float makes all three doubles.
const wrapVariant: VariantFunction = ([x, min, max]) => {
  if (!isScalar(x!.type)) return refused(0, 'FLOAT');
  if (!isScalar(min!.type)) return refused(1, x!.type);
  if (!isScalar(max!.type)) return refused(2, x!.type);
  if (x!.type === 'INT' && min!.type === 'INT' && max!.type === 'INT') {
    const [value, low, high] = [x!.value, min!.value, max!.value].map((bound) => BigInt(wrapInt32(bound)));
    return done(variant('INT', wrapi(value!, low!, high!)));
  }
  return done(variant('FLOAT', wrapf(toDouble(x!), toDouble(min!), toDouble(max!))));
};

/** `max` and `min`: the first argument that `operator` puts past every other, ints and floats only. */
function extreme(operator: 'OP_LESS' | 'OP_GREATER'): VariantFunction {
  return (args) => {
    if (args.length < 2) return { value: NIL, error: { error: 'TOO_FEW_ARGUMENTS', expected: 2 } };
    let base = args[0]!;
    for (const [index, argument] of args.entries()) {
      if (!isScalar(argument.type)) return refused(index, 'FLOAT');
      if (index > 0 && booleanize(evaluateOperator(operator, base, argument).value)) base = argument;
    }
    return done(base);
  };
}

const clampVariant: VariantFunction = ([x, min, max]) => {
  const below = evaluateOperator('OP_LESS', x!, min!);
  if (!below.isValid) return refused(1, x!.type);
  const value = booleanize(below.value) ? min! : x!;
  const above = evaluateOperator('OP_GREATER', value, max!);
  if (!above.isValid) return refused(2, value.type);
  return done(booleanize(above.value) ? max! : value);
};

export const VARIANT_MATH: Readonly<Record<string, VariantFunction>> = {
  floor: numeric({ method: 'floor', int: unchanged, float: Math.floor }),
  ceil: numeric({ method: 'ceil', int: unchanged, float: Math.ceil }),
  round: numeric({ method: 'round', int: unchanged, float: round }),
  abs: numeric({ method: 'abs', int: (x) => BigInt.asIntN(64, x < 0n ? -x : x), float: Math.abs }),
  sign: numeric({ method: 'sign', int: (x) => (x > 0n ? 1n : x < 0n ? -1n : 0n), float: sign }),
  snapped: snapVariant,
  lerp: lerpVariant,
  wrap: wrapVariant,
  max: extreme('OP_LESS'),
  min: extreme('OP_GREATER'),
  clamp: clampVariant,
};
