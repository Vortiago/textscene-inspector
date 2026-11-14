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
  if (arraySize === 0) return storage(type, 1, structOf).at(0);
  return arrayVariables(type, arraySize, structOf);
}

/** A new variable that starts at `value`, or new variables written from it for an array or a struct. */
export function variablesOf(value: Value, type: ValueType, arraySize: number, structOf: StructOf): Value {
  if (arraySize === 0 && !structOf(type)) return inVar(value);
  const variables = declareVariables(type, arraySize, structOf);
  copyInto(variables, value);
  return variables;
}

function arrayVariables(type: ValueType, arraySize: number, structOf: StructOf): Value {
  const elements = storage(type, arraySize, structOf);
  return arrayOf(arraySize, (index) => elements.at(index));
}

/** `count` values of `type` side by side: a TSL array of a value type, or one per member of a struct. */
interface Storage {
  at(index: Node | number): Value;
}

function storage(type: ValueType, count: number, structOf: StructOf): Storage {
  const struct = structOf(type);
  if (!struct) return valueStorage(type, count);
  const members = struct.members.map((member) => {
    const size = member.arraySize ?? 0;
    return { name: member.name, size, elements: storage(member.type, count * Math.max(size, 1), structOf) };
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

function valueStorage(type: ValueType, count: number): Storage {
  const zero = () => constantNode(type, filledLanes(shapeOf(type)!.scalar === 'bool' ? false : 0, type));
  if (count === 1) {
    const variable = property(type) as unknown as Node;
    return { at: () => variable };
  }
  const elements = inVar(array(Array.from({ length: count }, zero)));
  return { at: (index) => element(elements, indexNode(index)) };
}

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
