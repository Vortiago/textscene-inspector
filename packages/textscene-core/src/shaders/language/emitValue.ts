/**
 * The values the emitter holds: a TSL node for a value type, and for an array or a struct a view
 * of TSL variables. A struct is kept as one variable per member, and an array of structs as one
 * array per member, so a struct member may be an array, which three's struct type cannot hold.
 */

import { array, int, property, Var } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { constantNode } from './emitConstant.js';
import { element } from './emitOperation.js';
import type { StructNode, ValueType } from './shaderTree.js';
import { filledLanes, shapeOf } from './types.js';

/** An array: its element count and each element, at a constant or a computed index. */
export interface ArrayValue {
  readonly kind: 'array';
  readonly count: number;
  element(index: Node | number): Value;
}

/** A struct: the value of each member, by name. */
export interface StructValue {
  readonly kind: 'struct';
  readonly members: ReadonlyMap<string, Value>;
}

/** A value-type node, which is a place to assign to when it reads a variable. */
export type Value = Node | ArrayValue | StructValue;

/** `node` in a new TSL `Var`, written where it stands on the stack. */
export const inVar = (node: unknown): Node => Var(node as never) as unknown as Node;

export const isArrayValue = (value: Value): value is ArrayValue => (value as ArrayValue).kind === 'array';
export const isStructValue = (value: Value): value is StructValue => (value as StructValue).kind === 'struct';

/** The struct a type names, or nothing for a value type. */
export type StructOf = (type: ValueType) => StructNode | undefined;

/**
 * New variables for a value of `type`, `arraySize` elements, or one value for 0. A variable of a
 * value type starts undefined, as a GLSL local without a value does, and an array at zero.
 */
export function declareVariables(type: ValueType, arraySize: number, structOf: StructOf): Value {
  return variablesWithLeaves(type, arraySize, structOf).value;
}

/** A new variable that starts at `value`, or new variables written from it for an array or a struct. */
export function variablesOf(value: Value, type: ValueType, arraySize: number, structOf: StructOf): Value {
  if (arraySize === 0 && !structOf(type)) return inVar(value);
  const variables = declareVariables(type, arraySize, structOf);
  copyInto(variables, value);
  return variables;
}

/**
 * The types of a value's leaves, as a GLSL function takes the value: one per value-type member of
 * a struct, or the value itself, and an array where the value repeats it. A struct of arrays of
 * structs keeps each leaf in one flat array, as the emitter's variables do.
 */
export function leafTypes(type: ValueType, arraySize: number, structOf: StructOf): string[] {
  const types: string[] = [];
  viewOf(type, arraySize, structOf, (leafType, count) => {
    types.push(count === 1 ? leafType : `${leafType}[${count}]`);
    return { at: () => undefined as unknown as Value };
  });
  return types;
}

/** The value of `type` that `leaves` hold, in the order of `leafTypes`. */
export function valueOfLeaves(
  type: ValueType,
  arraySize: number,
  structOf: StructOf,
  leaves: readonly Node[]
): Value {
  let next = 0;
  return viewOf(type, arraySize, structOf, (_, count) => leafStorage(leaves[next++]!, count));
}

/** New variables for a value of `type`, and their leaves in the order of `leafTypes`. */
export function variablesWithLeaves(
  type: ValueType,
  arraySize: number,
  structOf: StructOf
): { value: Value; leaves: Node[] } {
  const leaves: Node[] = [];
  const value = viewOf(type, arraySize, structOf, (leafType, count) => {
    const leaf = newLeaf(leafType, count);
    leaves.push(leaf);
    return leafStorage(leaf, count);
  });
  return { value, leaves };
}

/** The leaves of `value`, copied into new variables where the copy stands on the stack. */
export function leavesOf(value: Value, type: ValueType, arraySize: number, structOf: StructOf): Node[] {
  const copy = variablesWithLeaves(type, arraySize, structOf);
  copyInto(copy.value, value);
  return copy.leaves;
}

/** `count` values of `type` side by side: a TSL array of a value type, or one per member of a struct. */
interface Storage {
  at(index: Node | number): Value;
}

/** The storage of `count` values of a value type, which a view reads its leaves from. */
type LeafStorage = (type: ValueType, count: number) => Storage;

/** A value of `type` whose leaves `leaf` stores. */
function viewOf(type: ValueType, arraySize: number, structOf: StructOf, leaf: LeafStorage): Value {
  const elements = storage(type, Math.max(arraySize, 1), structOf, leaf);
  return arraySize === 0 ? elements.at(0) : arrayOf(arraySize, (index) => elements.at(index));
}

function storage(type: ValueType, count: number, structOf: StructOf, leaf: LeafStorage): Storage {
  const struct = structOf(type);
  if (!struct) return leaf(type, count);
  const members = struct.members.map((member) => {
    const size = member.arraySize ?? 0;
    return {
      name: member.name,
      size,
      elements: storage(member.type, count * Math.max(size, 1), structOf, leaf),
    };
  });
  return {
    at: (index) => ({
      kind: 'struct',
      members: new Map(
        members.map(({ name, size, elements }) => [
          name,
          size === 0
            ? elements.at(index)
            : arrayOf(size, (inner) => elements.at(flatIndex(index, size, inner))),
        ])
      ),
    }),
  };
}

/** A new variable for one value of `type`, or a new array of `count` of them at zero. */
function newLeaf(type: ValueType, count: number): Node {
  if (count === 1) return property(type) as unknown as Node;
  const zero = () => constantNode(type, filledLanes(shapeOf(type)!.scalar === 'bool' ? false : 0, type));
  return inVar(array(Array.from({ length: count }, zero)));
}

/** The values a leaf holds: the leaf itself for one value, its elements for more. */
const leafStorage = (leaf: Node, count: number): Storage => ({
  at: (index) => (count === 1 ? leaf : element(leaf, indexNode(index))),
});

const arrayOf = (count: number, element: (index: Node | number) => Value): ArrayValue => ({
  kind: 'array',
  count,
  element,
});

/** Element `inner` of the `size` elements of instance `outer` in one flat array. */
function flatIndex(outer: Node | number, size: number, inner: Node | number): Node | number {
  if (typeof outer === 'number' && typeof inner === 'number') return outer * size + inner;
  return int(outer as never)
    .mul(size)
    .add(int(inner as never)) as unknown as Node;
}

const indexNode = (index: Node | number): Node =>
  typeof index === 'number' ? (int(index) as unknown as Node) : index;

/** Writes `source` into the places of `target`, element by element and member by member. */
export function copyInto(target: Value, source: Value): void {
  if (isArrayValue(target) && isArrayValue(source)) {
    for (let index = 0; index < target.count; index++) copyInto(target.element(index), source.element(index));
    return;
  }
  if (isStructValue(target) && isStructValue(source)) {
    for (const [name, member] of target.members) copyInto(member, source.members.get(name)!);
    return;
  }
  (target as Node).assign(source as Node);
}
