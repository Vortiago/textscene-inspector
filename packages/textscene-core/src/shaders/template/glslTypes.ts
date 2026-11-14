/**
 * The types of GLSL 4.50 that Godot's templates use, with the implicit conversions of section
 * 4.1.10 and of `GL_EXT_shader_explicit_arithmetic_types` for 16-bit floats: a value type's scalar
 * kind, its columns and its rows, and the opaque types (textures, samplers, images and subpass
 * inputs), which hold no value.
 */

export type GlslScalar = 'bool' | 'int' | 'uint' | 'float' | 'float16';

/** A value type: a scalar, a vector (one column) or a matrix. */
export interface GlslShape {
  readonly scalar: GlslScalar;
  /** 1 for a scalar or a vector. */
  readonly columns: number;
  /** The components of one column: 1 for a scalar. */
  readonly rows: number;
}

const VECTOR_PREFIX: Readonly<Record<GlslScalar, string>> = {
  bool: 'bvec',
  int: 'ivec',
  uint: 'uvec',
  float: 'vec',
  float16: 'f16vec',
};

const SCALAR_NAME: Readonly<Record<GlslScalar, string>> = {
  bool: 'bool',
  int: 'int',
  uint: 'uint',
  float: 'float',
  float16: 'float16_t',
};

/** The name of a value type: `float`, `uvec3`, `mat3`, `mat3x4`, `f16vec2`. */
export function shapeName(shape: GlslShape): string {
  if (shape.columns === 1)
    return shape.rows === 1 ? SCALAR_NAME[shape.scalar] : `${VECTOR_PREFIX[shape.scalar]}${shape.rows}`;
  const prefix = shape.scalar === 'float16' ? 'f16mat' : 'mat';
  return shape.columns === shape.rows
    ? `${prefix}${shape.columns}`
    : `${prefix}${shape.columns}x${shape.rows}`;
}

function valueShapes(): Map<string, GlslShape> {
  const shapes = new Map<string, GlslShape>();
  const add = (shape: GlslShape) => shapes.set(shapeName(shape), shape);
  for (const scalar of ['bool', 'int', 'uint', 'float', 'float16'] as const)
    for (const rows of [1, 2, 3, 4]) add({ scalar, columns: 1, rows });
  for (const scalar of ['float', 'float16'] as const)
    for (const columns of [2, 3, 4]) for (const rows of [2, 3, 4]) add({ scalar, columns, rows });
  const prefix = { float: 'mat', float16: 'f16mat' } as const;
  for (const scalar of ['float', 'float16'] as const)
    for (const size of [2, 3, 4])
      shapes.set(`${prefix[scalar]}${size}x${size}`, { scalar, columns: size, rows: size });
  return shapes;
}

const SHAPES = valueShapes();

/** The shape of a value type, or nothing for an opaque type, a struct or `void`. */
export const glslShapeOf = (type: string): GlslShape | undefined => SHAPES.get(type);

/** `mat4x4` and `mat4` are one type: the name the printer and the rows use. */
export const canonicalType = (type: string): string => {
  const shape = SHAPES.get(type);
  return shape ? shapeName(shape) : type;
};

const DIMENSIONS = [
  '1D',
  '2D',
  '3D',
  'Cube',
  '2DRect',
  '1DArray',
  '2DArray',
  'CubeArray',
  'Buffer',
  '2DMS',
  '2DMSArray',
];

function opaqueTypes(): Set<string> {
  const types = new Set([
    'sampler',
    'samplerShadow',
    'subpassInput',
    'isubpassInput',
    'usubpassInput',
    'subpassInputMS',
  ]);
  for (const prefix of ['', 'i', 'u'])
    for (const dimension of DIMENSIONS)
      for (const kind of ['sampler', 'texture', 'image']) types.add(`${prefix}${kind}${dimension}`);
  for (const dimension of ['1D', '2D', 'Cube', '2DRect', '1DArray', '2DArray', 'CubeArray'])
    types.add(`sampler${dimension}Shadow`);
  return types;
}

const OPAQUE = opaqueTypes();

/** Whether `type` is a texture, a sampler, an image or a subpass input. */
export const isOpaqueType = (type: string): boolean => OPAQUE.has(type);

/** Whether `name` is a type keyword of GLSL. */
export const isTypeKeyword = (name: string): boolean =>
  name === 'void' || SHAPES.has(name) || OPAQUE.has(name);

/** Where an implicit conversion goes, by the rank of section 6.1: lower is better. */
const CONVERSIONS: Readonly<Partial<Record<GlslScalar, readonly GlslScalar[]>>> = {
  int: ['uint', 'float'],
  uint: ['float'],
  float16: ['float'],
};

/** Whether a value of type `from` converts implicitly to type `to` (section 4.1.10). */
export function convertsImplicitly(from: string, to: string): boolean {
  if (canonicalType(from) === canonicalType(to)) return true;
  const source = SHAPES.get(from);
  const target = SHAPES.get(to);
  if (!source || !target || source.columns !== target.columns || source.rows !== target.rows) return false;
  if (source.columns > 1 && source.scalar !== 'float16') return false;
  return CONVERSIONS[source.scalar]?.includes(target.scalar) ?? false;
}

/** `shape` with its scalar kind replaced: `ivec3` as `vec3`. */
export const withScalar = (shape: GlslShape, scalar: GlslScalar): string => shapeName({ ...shape, scalar });

/**
 * The scalar two operands share after their implicit conversions: `uint` for `int` and `uint`,
 * `float` for an integer and a float. Nothing when neither converts to the other.
 */
export function commonScalar(a: GlslScalar, b: GlslScalar): GlslScalar | undefined {
  if (a === b) return a;
  if (CONVERSIONS[a]?.includes(b)) return b;
  if (CONVERSIONS[b]?.includes(a)) return a;
  return undefined;
}

/** A type with the array size of its outermost dimension, when it has one. */
export interface SizedType {
  readonly type: string;
  readonly arraySize?: number;
}

/**
 * The type of a name declared with `sizes`, outermost first. An array of arrays keeps its inner
 * sizes in the element type, as GLSL writes it: `vec4 a[7][5]` is 7 of `vec4[5]`.
 */
export function arrayOf(type: string, sizes: readonly number[]): SizedType {
  const [outer, ...inner] = sizes;
  if (outer === undefined) return { type };
  return { type: type + inner.map((size) => `[${size}]`).join(''), arraySize: outer };
}

/** An element of an array of arrays, `vec4[5]`, as the array it is: 5 of `vec4`. */
export function elementOf(type: string): SizedType {
  const sizes = [...type.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
  return arrayOf(type.replace(/\[.*$/, ''), sizes);
}

/** GLSL's `length()` of a vector or a matrix, its components or its columns: 0 for another type. */
export function lengthOf(type: string): number {
  const shape = SHAPES.get(type);
  if (!shape) return 0;
  return shape.columns > 1 ? shape.columns : shape.rows;
}

/** The type of part `index` of an initialiser list of a vector or a matrix: a scalar or a column. */
export function initialiserPart(type: string, index: number): SizedType | undefined {
  const shape = SHAPES.get(type);
  if (!shape || index >= lengthOf(type)) return undefined;
  return { type: shapeName({ scalar: shape.scalar, columns: 1, rows: shape.columns > 1 ? shape.rows : 1 }) };
}
