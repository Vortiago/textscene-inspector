import { abs, equal, floor, fract, mod, notEqual, round, select, trunc } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { byLane, chained, type Composite, laneOf, lanesOf, splat, tsl } from './compositeParts.js';
import { CONSTRUCTORS, floatNode } from './emitConstant.js';
import { columnOf } from './emitOperation.js';
import { EXPONENT_COMPOSITES } from './exponentComposites.js';
import { INTEGER_COMPOSITES } from './integerComposites.js';
import { NEAREST_COMPOSITES } from './nearestComposites.js';
import { shapeOf } from './types.js';

/** `roundEven` of one float: `round(x)`, but a half goes to the even one of `floor(x) + mod(floor(x), 2)`. */
function roundEvenLane(x: Node): Node {
  const below = tsl(floor)(x);
  const isHalf = tsl(equal)(tsl(fract)(x), floatNode(0.5));
  return tsl(select)(isHalf, chained(below).add(tsl(mod)(below, floatNode(2))), tsl(round)(x));
}

const roundEven: Composite = ([x], [type]) =>
  byLane(type!, (index) => roundEvenLane(laneOf(x!, type!, index)));

const isnan: Composite = ([x]) => tsl(notEqual)(x!, x!);

const isinf: Composite = ([x], [type]) => tsl(equal)(tsl(abs)(x!), splat(type!, Infinity));

/** `mix(a, b, t)` with a `bvec` `t`: each lane of `b` where `t` is true, else of `a`. */
const mixByLane: Composite = ([a, b, t], [type]) =>
  byLane(type!, (index) =>
    tsl(select)(laneOf(t!, type!, index), laneOf(b!, type!, index), laneOf(a!, type!, index))
  );

const matrixCompMult: Composite = ([a, b], [type]) =>
  CONSTRUCTORS[type!]!(
    ...Array.from({ length: shapeOf(type!)!.columns! }, (_, column) =>
      chained(columnOf(a!, column)).mul(columnOf(b!, column))
    )
  );

/** `outerProduct(c, r)`: column `j` is `c * r[j]`. */
const outerProduct: Composite = ([c, r], [type]) =>
  CONSTRUCTORS[`mat${lanesOf(type!)}`]!(
    ...Array.from({ length: lanesOf(type!) }, (_, column) => chained(c!).mul(laneOf(r!, type!, column)))
  );

/** `x`'s zero: -0 where `x` is negative, or -0 as `1 / x` tells, and +0 elsewhere. */
function zeroOf(x: Node): Node {
  const isBelowZero = (node: Node) => chained(node).lessThan(floatNode(0));
  const isNegative = chained(isBelowZero(x)).or(isBelowZero(chained(floatNode(1)).div(x)));
  return tsl(select)(isNegative, floatNode(-0), floatNode(0));
}

/** GLSL's sign: `-1.0` gives -0, and an infinity gives its zero where the difference gives NaN. */
function fractionLane(x: Node): Node {
  const difference = chained(x).sub(tsl(trunc)(x));
  const isZero = chained(tsl(equal)(difference, floatNode(0))).or(isinf([x], ['float']));
  return tsl(select)(isZero, zeroOf(x), difference);
}

/** `modf(x, whole)`: writes `trunc(x)` to `whole`, the call's out variable, and gives the fraction. */
const modf: Composite = ([x, whole], [type]) => {
  chained(whole!).assign(tsl(trunc)(x!));
  return byLane(type!, (index) => fractionLane(laneOf(x!, type!, index)));
};

/** Each composite, by its GLSL name. `mix` is one only with a `bvec` blend (`compositeOf`). */
const COMPOSITES: Readonly<Record<string, Composite>> = {
  ...INTEGER_COMPOSITES,
  ...EXPONENT_COMPOSITES,
  ...NEAREST_COMPOSITES,
  roundEven,
  modf,
  isnan,
  isinf,
  matrixCompMult,
  outerProduct,
};

/** The composite of the call of `name` over `args`, or nothing where three/tsl has the function. */
export function compositeOf(name: string, args: readonly string[]): Composite | undefined {
  if (name === 'mix' && args[2]!.startsWith('b')) return mixByLane;
  return COMPOSITES[name];
}
