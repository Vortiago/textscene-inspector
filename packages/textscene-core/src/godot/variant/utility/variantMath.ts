import type { BasisComponents } from '../../math/basis.js';
import { wrapf, wrapi } from '../../math/doubleMath.js';
import { lerp, lerpf, round, sign, snapped } from '../../math/math.js';
import { quaternionSlerp, type Quaternion } from '../../math/quaternion.js';
import { storedReal as f } from '../../math/real.js';
import { transform2DInterpolateWith } from '../../math/transform2d.js';
import { interpolateTransform3D } from '../../math/transform3d.js';
import { doubleToInt32, doubleToInt64, wrapInt32 } from '../cInteger.js';
import { booleanize } from '../compare.js';
import { mapComponents, toDouble, type Components } from '../construct/variantCast.js';
import { basisSlerp } from '../call/basisMethods.js';
import { evaluateOperator } from '../operators/evaluate.js';
import { NIL, variant, type Variant, type VariantTypeName } from '../value/variant.js';
import { invalidArgument, type UtilityResult } from './callError.js';
import type { VariantFunction } from './utilityFunction.js';

const FLOAT_VECTORS: ReadonlySet<VariantTypeName> = new Set(['VECTOR2', 'VECTOR3', 'VECTOR4']);
const INT_VECTORS: ReadonlySet<VariantTypeName> = new Set(['VECTOR2I', 'VECTOR3I', 'VECTOR4I']);
const isScalar = (type: VariantTypeName) => type === 'INT' || type === 'FLOAT';
const isNumeric = (type: VariantTypeName) =>
  isScalar(type) || FLOAT_VECTORS.has(type) || INT_VECTORS.has(type);

const NUMERIC_EXPECTED =
  'Argument "x" must be "int", "float", "Vector2", "Vector2i", "Vector3", "Vector3i", "Vector4", or "Vector4i".';
const STEP_EXPECTED = 'Argument "step" must be "int" or "float".';
const LERP_EXPECTED =
  'Argument "from" must be "int", "float", "Vector2", "Vector3", "Vector4", "Color", "Quaternion", "Basis", "Transform2D", or "Transform3D".';
const LERP_TYPES: ReadonlySet<VariantTypeName> = new Set([
  'INT',
  'FLOAT',
  'VECTOR2',
  'VECTOR3',
  'VECTOR4',
  'QUATERNION',
  'BASIS',
  'COLOR',
  'TRANSFORM2D',
  'TRANSFORM3D',
]);

const done = (value: Variant): UtilityResult => ({ value });
const made = (type: VariantTypeName, value: unknown) => variant(type, value as never) as Variant;
const refused = (argument: number, expected: VariantTypeName, value: Variant = NIL): UtilityResult => ({
  value,
  error: invalidArgument(argument, expected),
});

const pairComponents = (a: unknown, b: unknown, map: (x: number, y: number) => number): Components =>
  Object.fromEntries(
    Object.entries(a as Components).map(([key, x]) => [key, map(x, (b as Components)[key]!)])
  );

/** How one of floor, ceil, round, abs and sign treats an int, a float, and a component of each vector. */
interface NumericRule {
  readonly int: (x: bigint) => bigint;
  readonly float: (x: number) => number;
  readonly intComponent: (x: number) => number;
}

function numeric(rule: NumericRule): VariantFunction {
  return ([x]) => {
    if (x!.type === 'INT') return done(variant('INT', rule.int(x!.value)));
    if (x!.type === 'FLOAT') return done(variant('FLOAT', rule.float(x!.value)));
    if (FLOAT_VECTORS.has(x!.type)) return done(made(x!.type, mapComponents(x!.value, rule.float)));
    if (INT_VECTORS.has(x!.type)) return done(made(x!.type, mapComponents(x!.value, rule.intComponent)));
    return refused(0, 'NIL', variant('STRING', NUMERIC_EXPECTED));
  };
}

const unchanged = <T>(x: T) => x;

const snapVariant: VariantFunction = ([x, step]) => {
  if (!isNumeric(x!.type)) return refused(0, 'NIL', variant('STRING', NUMERIC_EXPECTED));
  if (x!.type !== step!.type) {
    if (!isScalar(x!.type)) return refused(1, x!.type);
    if (!isScalar(step!.type)) return refused(1, 'NIL', variant('STRING', STEP_EXPECTED));
  }
  if (step!.type === 'INT')
    return done(variant('INT', doubleToInt64(snapped(toDouble(x!), Number(step!.value)))));
  if (step!.type === 'FLOAT') return done(variant('FLOAT', snapped(toDouble(x!), step!.value)));
  const component = INT_VECTORS.has(step!.type) ? doubleToInt32 : f;
  const snappedVector = pairComponents(x!.value, step!.value, (a, b) => component(snapped(a, b)));
  return done(made(step!.type, snappedVector));
};

// The weight of a type whose `lerp` takes a real_t or a float narrows to float first.
function lerpOf(from: Variant, to: Variant, weight: number): Variant {
  const real = f(weight);
  switch (from.type) {
    case 'INT':
    case 'FLOAT':
      return variant('FLOAT', lerp(toDouble(from), toDouble(to), weight));
    case 'QUATERNION':
      return variant('QUATERNION', quaternionSlerp(from.value, to.value as Quaternion, real));
    case 'BASIS':
      return variant('BASIS', basisSlerp(from.value, to.value as BasisComponents, real));
    case 'TRANSFORM2D':
      return variant('TRANSFORM2D', transform2DInterpolateWith(from.value, to.value as never, real));
    case 'TRANSFORM3D':
      return variant('TRANSFORM3D', interpolateTransform3D(from.value, to.value as never, real));
    default:
      return made(
        from.type,
        pairComponents(from.value, to.value, (a, b) => lerpf(a, b, real))
      );
  }
}

const lerpVariant: VariantFunction = ([from, to, weight]) => {
  if (!LERP_TYPES.has(from!.type)) return refused(0, 'NIL', variant('STRING', LERP_EXPECTED));
  if (from!.type !== to!.type) return refused(1, from!.type);
  return done(lerpOf(from!, to!, toDouble(weight!)));
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
  floor: numeric({ int: unchanged, float: Math.floor, intComponent: unchanged }),
  ceil: numeric({ int: unchanged, float: Math.ceil, intComponent: unchanged }),
  round: numeric({ int: unchanged, float: round, intComponent: unchanged }),
  abs: numeric({
    int: (x) => BigInt.asIntN(64, x < 0n ? -x : x),
    float: Math.abs,
    intComponent: (x) => Math.abs(x) | 0,
  }),
  sign: numeric({ int: (x) => (x > 0n ? 1n : x < 0n ? -1n : 0n), float: sign, intComponent: sign }),
  snapped: snapVariant,
  lerp: lerpVariant,
  wrap: wrapVariant,
  max: extreme('OP_LESS'),
  min: extreme('OP_GREATER'),
  clamp: clampVariant,
};
