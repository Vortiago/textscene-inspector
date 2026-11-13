/**
 * The data types of Godot's shading language that hold values (`DataType`, `shader_language.h:209`):
 * each one's scalar kind and lane count, as the parser types an expression and the emitter builds
 * its TSL node.
 */

/** A Godot type name, `float` or `ivec3`. */
export type ValueType = string;

export type ScalarKind = 'bool' | 'int' | 'uint' | 'float';

export interface TypeShape {
  readonly scalar: ScalarKind;
  /** Every lane, a matrix's columns one after the other. */
  readonly lanes: number;
  /** The column count of a matrix. A scalar or a vector has none. */
  readonly columns?: number;
}

const VECTOR_PREFIX: Readonly<Record<ScalarKind, string>> = {
  bool: 'bvec',
  int: 'ivec',
  uint: 'uvec',
  float: 'vec',
};

function shapes(): Map<ValueType, TypeShape> {
  const entries: [ValueType, TypeShape][] = [];
  for (const scalar of ['bool', 'int', 'uint', 'float'] as const) {
    entries.push([scalar, { scalar, lanes: 1 }]);
    for (const lanes of [2, 3, 4]) entries.push([`${VECTOR_PREFIX[scalar]}${lanes}`, { scalar, lanes }]);
  }
  for (const size of [2, 3, 4])
    entries.push([`mat${size}`, { scalar: 'float', lanes: size * size, columns: size }]);
  return new Map(entries);
}

const SHAPES = shapes();

/** The shape of a type that holds values, or nothing for `void`, a sampler or a struct. */
export const shapeOf = (type: ValueType): TypeShape | undefined => SHAPES.get(type);

/** The type of `lanes` lanes of `scalar`: `float` for one, `vec3` for three. */
export function vectorType(scalar: ScalarKind, lanes: number): ValueType {
  return lanes === 1 ? scalar : `${VECTOR_PREFIX[scalar]}${lanes}`;
}

/** The type `owner[i]` reads: a vector's scalar or a matrix's column, or nothing for a scalar. */
export function elementType(owner: ValueType): ValueType | undefined {
  const shape = shapeOf(owner);
  if (!shape || shape.lanes === 1) return undefined;
  return shape.columns === undefined ? shape.scalar : `vec${shape.columns}`;
}

/**
 * The lanes of `type` that one scalar fills: every lane of a vector, or a matrix's diagonal with
 * zeros elsewhere, as both Godot (`shader_language.cpp:7882`) and GLSL construct it.
 */
export function filledLanes<T>(value: T, type: ValueType): (T | 0)[] {
  const shape = shapeOf(type)!;
  if (shape.columns === undefined) return Array<T>(shape.lanes).fill(value);
  return Array.from({ length: shape.lanes }, (_, lane) => (lane % (shape.columns! + 1) === 0 ? value : 0));
}
