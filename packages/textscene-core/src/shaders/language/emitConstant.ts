import {
  bool,
  convert,
  bvec2,
  bvec3,
  bvec4,
  float,
  int,
  ivec2,
  ivec3,
  ivec4,
  mat2,
  mat3,
  mat4,
  uint,
  uintBitsToFloat,
  uvec2,
  uvec3,
  uvec4,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { INT32_MIN } from '../../godot/variant/intWidth.js';
import type { Scalar } from './shaderTree.js';
import { shapeOf, type ValueType } from './types.js';

/** three's types take no node list here, though each constructor takes one. */
export type Constructor = (...args: Node[]) => Node;

/** The TSL constructor of each value type, by Godot's type name. */
export const CONSTRUCTORS: Readonly<Record<string, Constructor>> = Object.fromEntries(
  Object.entries({
    bool,
    bvec2,
    bvec3,
    bvec4,
    int,
    ivec2,
    ivec3,
    ivec4,
    uint,
    uvec2,
    uvec3,
    uvec4,
    float,
    vec2,
    vec3,
    vec4,
    mat2,
    mat3,
    mat4,
  }).map(([name, constructor]) => [name, constructor as unknown as Constructor])
);

/** The constant of `type` with `lanes`, a matrix's columns one after the other. */
export function constantNode(type: ValueType, lanes: readonly Scalar[]): Node {
  const shape = shapeOf(type)!;
  const components = lanes.map((lane) => scalarNode(shape.scalar, lane));
  if (shape.lanes === 1) return components[0]!;
  if (shape.columns === undefined) return CONSTRUCTORS[type]!(...components);
  const column = CONSTRUCTORS[`vec${shape.columns}`]!;
  const columns = Array.from({ length: shape.columns }, (_, index) =>
    column(...components.slice(index * shape.columns!, (index + 1) * shape.columns!))
  );
  return CONSTRUCTORS[type]!(...columns);
}

/**
 * The inner convert keeps the constant in `from`, as three writes a negative `uint` constant as `0u`.
 *
 * @canonical Convert a node to another GLSL type
 */
export const convertedNode = (node: Node, from: string, to: string): Node =>
  convert(convert(node, from as never), to as never) as unknown as Node;

/** The constant `lane` of the scalar type `scalar`. */
export function scalarNode(scalar: string, lane: Scalar): Node {
  if (scalar === 'bool') return bool(lane as boolean) as unknown as Node;
  if (scalar === 'uint') return uint(lane as number) as unknown as Node;
  if (scalar === 'int') {
    // GLSL has no literal for the least int, and three folds a conversion of a constant to its value.
    if (lane === INT32_MIN) return int(INT32_MIN + 1).sub(1) as unknown as Node;
    return int(lane as number) as unknown as Node;
  }
  return floatNode(lane as number);
}

/** Three writes -0 as `0.0` and infinity as `Infinity.0`, so those and NaN are written as bits. */
export function floatNode(value: number): Node {
  const rounded = Math.fround(value);
  if (Number.isFinite(rounded) && !Object.is(rounded, -0)) return float(rounded) as unknown as Node;
  return uintBitsToFloat(uint(new Uint32Array(new Float32Array([rounded]).buffer)[0]!)) as unknown as Node;
}
