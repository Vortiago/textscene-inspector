import { toInt32 } from '../../godot/variant/intWidth.js';
import type { Scalar } from './shaderTree.js';
import type { ScalarKind, TypeShape } from './types.js';

export type Lanes = readonly Scalar[];

type FloatLane = (x: number) => Scalar;

/** glslang's `pi` (`Constant.cpp:49`) is the double nearest π, which `Math.PI` is too. */
const PI = Math.PI;

/** `SIGN` of `Constant.cpp`: 0 for either zero, 1 for NaN. */
const sign = (x: number) => (x === 0 ? 0 : x < 0 ? -1 : 1);

/** The derivatives fold to 0: GLSL mandates it for a constant. */
const DERIVATIVES = [
  'dFdx',
  'dFdy',
  'fwidth',
  'dFdxFine',
  'dFdyFine',
  'fwidthFine',
  'dFdxCoarse',
  'dFdyCoarse',
  'fwidthCoarse',
];

/** The lane by lane folds of one float argument, in the order of `Constant.cpp`. */
const FLOAT_LANE_CALLS: Readonly<Record<string, FloatLane>> = {
  radians: (x) => (x * PI) / 180,
  degrees: (x) => (x * 180) / PI,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ...Object.fromEntries(DERIVATIVES.map((name) => [name, () => 0])),
  exp: Math.exp,
  log: Math.log,
  exp2: (x) => 2 ** x,
  log2: Math.log2,
  sqrt: Math.sqrt,
  inversesqrt: (x) => 1 / Math.sqrt(x),
  abs: Math.abs,
  sign,
  floor: Math.floor,
  trunc: (x) => (x > 0 ? Math.floor(x) : Math.ceil(x)),
  round: (x) => Math.floor(0.5 + x),
  roundEven,
  ceil: Math.ceil,
  fract: (x) => x - Math.floor(x),
  isnan: Number.isNaN,
  isinf: (x) => x === Infinity || x === -Infinity,
};

/** `EOpRoundEven`: a half goes to the even neighbour. */
function roundEven(x: number): number {
  const floor = Math.floor(x);
  const isEven = floor / 2 === Math.floor(floor / 2);
  return isEven ? Math.ceil(x - 0.5) : Math.floor(x + 0.5);
}

/** `abs` and `sign` of an integer lane: C's `abs` gives the least `int` for itself. */
function integerLaneCall(name: string, scalar: ScalarKind): FloatLane | undefined {
  if (name === 'sign') return sign;
  if (name !== 'abs') return undefined;
  return scalar === 'int' ? (x) => toInt32(Math.abs(x)) : (x) => x;
}

/** The fold of a call of one constant argument, or nothing for a call glslang leaves. */
function unaryCall(name: string, arg: Lanes, shape: TypeShape): Lanes | undefined {
  switch (name) {
    case 'length':
      return [Math.sqrt(dot(arg, arg))];
    case 'normalize': {
      const length = Math.sqrt(dot(arg, arg));
      return arg.map((lane) => (lane as number) / length);
    }
    case 'any':
      return [arg.some(Boolean)];
    case 'all':
      return [arg.every(Boolean)];
    case 'not':
      return arg.map((lane) => !lane);
  }
  const lane = shape.scalar === 'float' ? FLOAT_LANE_CALLS[name] : integerLaneCall(name, shape.scalar);
  return lane && arg.map((value) => lane(value as number));
}

/** `TConstUnionArray::dot`: a sum of products in double precision, from zero. */
function dot(a: Lanes, b: Lanes): number {
  let sum = 0;
  for (let lane = 0; lane < a.length; lane += 1) sum += (a[lane] as number) * (b[lane] as number);
  return sum;
}

/** `std::min` and `std::max`, which give the first argument when the two do not compare. */
const min = (a: number, b: number) => (b < a ? b : a);
const max = (a: number, b: number) => (a < b ? b : a);

type LaneOfArgs = (args: readonly Scalar[]) => Scalar;

/** The lane by lane folds of more than one argument, a scalar argument standing for every lane. */
const COMPONENTWISE_CALLS: Readonly<Record<string, LaneOfArgs>> = {
  atan: ([y, x]) => Math.atan2(y as number, x as number),
  pow: ([x, y]) => Math.pow(x as number, y as number),
  mod: ([x, y]) => (x as number) - (y as number) * Math.floor((x as number) / (y as number)),
  min: ([a, b]) => min(a as number, b as number),
  max: ([a, b]) => max(a as number, b as number),
  clamp: ([x, low, high]) => min(max(x as number, low as number), high as number),
  lessThan: ([a, b]) => (a as number) < (b as number),
  greaterThan: ([a, b]) => (a as number) > (b as number),
  lessThanEqual: ([a, b]) => !((a as number) > (b as number)),
  greaterThanEqual: ([a, b]) => !((a as number) < (b as number)),
  equal: ([a, b]) => a === b,
  notEqual: ([a, b]) => a !== b,
  mix: ([x, y, a]) => (x as number) * (1 - (a as number)) + (y as number) * (a as number),
  step: ([edge, x]) => ((x as number) < (edge as number) ? 0 : 1),
  smoothstep: ([low, high, x]) => {
    let t = ((x as number) - (low as number)) / ((high as number) - (low as number));
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return t * t * (3 - 2 * t);
  },
};

/**
 * The lane count of a lane by lane fold: the first argument's, but the larger of the edge and the
 * value for `step` and `smoothstep`.
 */
function componentwiseLanes(name: string, shapes: readonly TypeShape[]): number {
  if (name === 'step') return Math.max(shapes[0]!.lanes, shapes[1]!.lanes);
  if (name === 'smoothstep') return Math.max(shapes[0]!.lanes, shapes[2]!.lanes);
  return shapes[0]!.lanes;
}

/** `mix` with a `bool` or `bvec` blend: the second argument where the blend is true. */
const mixByBlend: LaneOfArgs = ([x, y, blend]) => (blend ? y! : x!);

/** The lane fold of `name`. glslang folds `mix` of floats only. */
function componentwiseLane(name: string, shapes: readonly TypeShape[]): LaneOfArgs | undefined {
  if (name !== 'mix') return COMPONENTWISE_CALLS[name];
  if (shapes[0]!.scalar !== 'float') return undefined;
  return shapes[2]!.scalar === 'bool' ? mixByBlend : COMPONENTWISE_CALLS.mix;
}

function componentwiseCall(name: string, args: readonly Lanes[], shapes: readonly TypeShape[]) {
  const lane = componentwiseLane(name, shapes);
  if (!lane) return undefined;
  return Array.from({ length: componentwiseLanes(name, shapes) }, (_, at) =>
    lane(args.map((arg) => arg[Math.min(at, arg.length - 1)]!))
  );
}

/** The folds of more than one argument that are not lane by lane. */
function wholeVectorCall(name: string, args: readonly Lanes[]): Lanes | undefined {
  const [a, b, c] = args.map((arg) => arg.map(Number));
  switch (name) {
    case 'distance': {
      const differences = a!.map((lane, at) => b![at]! - lane);
      return [Math.sqrt(dot(differences, differences))];
    }
    case 'dot':
      return [dot(a!, b!)];
    case 'cross':
      return [
        a![1]! * b![2]! - a![2]! * b![1]!,
        a![2]! * b![0]! - a![0]! * b![2]!,
        a![0]! * b![1]! - a![1]! * b![0]!,
      ];
    case 'faceforward':
      return dot(b!, c!) < 0 ? a! : a!.map((lane) => -lane);
    case 'reflect': {
      const twice = 2 * dot(a!, b!);
      return a!.map((lane, at) => lane - twice * b![at]!);
    }
    case 'refract':
      return refracted(a!, b!, c![0]!);
    case 'outerProduct':
      return b!.flatMap((column) => a!.map((row) => row * column));
  }
  return undefined;
}

/** `refract(I, N, eta)`: zero lanes when `k` is negative, past the critical angle. */
function refracted(incident: readonly number[], normal: readonly number[], eta: number): Lanes {
  const cosine = dot(incident, normal);
  const k = 1 - eta * eta * (1 - cosine * cosine);
  if (k < 0) return incident.map(() => 0);
  const scale = eta * cosine + Math.sqrt(k);
  return incident.map((lane, at) => eta * lane - scale * normal[at]!);
}

/** The fold of the built-in call `name` of constant arguments, or nothing for one glslang leaves. */
export function foldedCall(name: string, args: readonly Lanes[], shapes: readonly TypeShape[]) {
  if (args.length === 1) return unaryCall(name, args[0]!, shapes[0]!);
  return componentwiseCall(name, args, shapes) ?? wholeVectorCall(name, args);
}
