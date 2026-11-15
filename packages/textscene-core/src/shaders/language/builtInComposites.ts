/**
 * The built-in functions three/tsl has no function for, each built from TSL nodes as GLSL defines
 * it: `roundEven`, `modf`, `isnan`, `isinf`, `matrixCompMult`, `outerProduct`, and `mix` with a
 * `bvec` blend, which three's `mix` casts to a float.
 */

import { abs, equal, floor, fract, int, mod, notEqual, round, select, trunc } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { CONSTRUCTORS, floatNode } from './emitConstant.js';
import { columnOf, element } from './emitOperation.js';
import { shapeOf } from './types.js';

/** A composite of the operands of a call over the overload's argument types `args`. */
export type Composite = (operands: readonly Node[], args: readonly string[]) => Node;

/** three's types narrow each function to a few node types. Each takes any node of a GLSL type. */
const tsl = (operation: unknown) => operation as (...operands: Node[]) => Node;

/** The chained operations of a TSL node, which three's types leave out of `Node`. */
interface Chained {
  add(node: Node): Node;
  sub(node: Node): Node;
  mul(node: Node): Node;
  div(node: Node): Node;
  lessThan(node: Node): Node;
  or(node: Node): Node;
  assign(node: Node): Node;
}

const chained = (node: Node) => node as unknown as Chained;

const lanesOf = (type: string) => shapeOf(type)?.lanes ?? 1;

/** `type` filled with the float `value` in every lane. */
const splat = (type: string, value: number) =>
  type === 'float' ? floatNode(value) : CONSTRUCTORS[type]!(floatNode(value));

/** A vector of `type` whose lane `i` is `lane(i)`, or the scalar `lane(0)`. */
function byLane(type: string, lane: (index: number) => Node): Node {
  const lanes = Array.from({ length: lanesOf(type) }, (_, index) => lane(index));
  return lanes.length === 1 ? lanes[0]! : CONSTRUCTORS[type]!(...lanes);
}

/** Lane `index` of `vector`, or the scalar itself. */
const laneOf = (vector: Node, type: string, index: number) =>
  lanesOf(type) === 1 ? vector : element(vector, int(index) as unknown as Node);

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

/**
 * The fraction of one float, `x - trunc(x)`, with GLSL's sign: `-1.0` gives -0, and an infinity
 * gives its zero where the difference gives NaN.
 */
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
