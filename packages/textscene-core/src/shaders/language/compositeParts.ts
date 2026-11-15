import type { Node } from 'three/webgpu';
import { CONSTRUCTORS, floatNode, scalarNode } from './emitConstant.js';
import { element } from './emitOperation.js';
import { shapeOf, type ScalarKind, vectorType } from './types.js';

export type Composite = (operands: readonly Node[], args: readonly string[]) => Node;

/** three's types narrow each function to a few node types. Each takes any node of a GLSL type. */
export const tsl = (operation: unknown) => operation as (...operands: Node[]) => Node;

/** The chained operations of a TSL node, which three's types leave out of `Node`. */
interface Chained {
  add(node: Node): Node;
  sub(node: Node): Node;
  mul(node: Node): Node;
  div(node: Node): Node;
  lessThan(node: Node): Node;
  or(node: Node): Node;
  and(node: Node): Node;
  assign(node: Node): Node;
}

export const unsignedNode = (value: number) => scalarNode('uint', value);
export const intNode = (value: number) => scalarNode('int', value);

export const chained = (node: Node) => node as unknown as Chained;

export const lanesOf = (type: string) => shapeOf(type)?.lanes ?? 1;

/** The type of `type`'s shape with `scalar` lanes: `uvec3` for `vec3` and `uint`. */
export const withScalar = (type: string, scalar: ScalarKind) => vectorType(scalar, lanesOf(type));

/**
 * `type` filled with the float `value` in every lane.
 *
 * @canonical A composite's float constant in every lane
 */
export const splat = (type: string, value: number) =>
  type === 'float' ? floatNode(value) : CONSTRUCTORS[type]!(floatNode(value));

/**
 * A vector of `type` whose lane `i` is `lane(i)`, or the scalar `lane(0)`.
 *
 * @canonical A composite's result built lane by lane
 */
export function byLane(type: string, lane: (index: number) => Node): Node {
  const lanes = Array.from({ length: lanesOf(type) }, (_, index) => lane(index));
  return lanes.length === 1 ? lanes[0]! : CONSTRUCTORS[type]!(...lanes);
}

/**
 * Lane `index` of `vector`, or the scalar itself.
 *
 * @canonical One lane of a composite's operand
 */
export const laneOf = (vector: Node, type: string, index: number) =>
  lanesOf(type) === 1 ? vector : element(vector, intNode(index));
