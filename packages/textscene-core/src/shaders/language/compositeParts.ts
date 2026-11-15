import { int, uint } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { CONSTRUCTORS, floatNode } from './emitConstant.js';
import { element } from './emitOperation.js';
import { shapeOf, type ScalarKind, vectorType } from './types.js';

export type Composite = (operands: readonly Node[], args: readonly string[]) => Node;

// three's types accept only a few node types per function.
export const tsl = (operation: unknown) => operation as (...operands: Node[]) => Node;

// three's `Node` type leaves these out.
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

export const unsignedNode = (value: number) => uint(value) as unknown as Node;
export const intNode = (value: number) => int(value) as unknown as Node;

export const chained = (node: Node) => node as unknown as Chained;

export const lanesOf = (type: string) => shapeOf(type)?.lanes ?? 1;

export const withScalar = (type: string, scalar: ScalarKind) => vectorType(scalar, lanesOf(type));

export const splat = (type: string, value: number) =>
  type === 'float' ? floatNode(value) : CONSTRUCTORS[type]!(floatNode(value));

export function byLane(type: string, lane: (index: number) => Node): Node {
  const lanes = Array.from({ length: lanesOf(type) }, (_, index) => lane(index));
  return lanes.length === 1 ? lanes[0]! : CONSTRUCTORS[type]!(...lanes);
}

export const laneOf = (vector: Node, type: string, index: number) =>
  lanesOf(type) === 1 ? vector : element(vector, int(index) as unknown as Node);
