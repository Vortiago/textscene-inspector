import type { BasisComponents } from '../../math/basis.js';
import type { Variant, VariantValues, Vector3Value, Vector4Value } from './variant.js';

/** The C++ type of each component: `int32_t`, `real_t`, or `float`, which Color keeps in a 64-bit build. */
export type ComponentType = 'int32' | 'real' | 'float';

/** The math types whose value is a C++ struct of components: Vector2 to Projection, and Color. */
export type MathTypeName =
  | 'VECTOR2'
  | 'VECTOR2I'
  | 'RECT2'
  | 'RECT2I'
  | 'VECTOR3'
  | 'VECTOR3I'
  | 'TRANSFORM2D'
  | 'VECTOR4'
  | 'VECTOR4I'
  | 'PLANE'
  | 'QUATERNION'
  | 'AABB'
  | 'BASIS'
  | 'TRANSFORM3D'
  | 'PROJECTION'
  | 'COLOR';

/** A struct's components in its memory order, as Godot hashes, encodes and writes them. */
interface MathLayout<T extends MathTypeName> {
  readonly component: ComponentType;
  readonly count: number;
  readonly flat: (value: VariantValues[T]) => number[];
  readonly fromFlat: (components: readonly number[]) => VariantValues[T];
}

const xy = ({ x, y }: { x: number; y: number }) => [x, y];
const xyz = ({ x, y, z }: Vector3Value) => [x, y, z];
const xyzw = ({ x, y, z, w }: Vector4Value) => [x, y, z, w];
const vector2At = (c: readonly number[], at = 0) => ({ x: c[at]!, y: c[at + 1]! });
const vector3At = (c: readonly number[], at = 0) => ({ x: c[at]!, y: c[at + 1]!, z: c[at + 2]! });
const vector4At = (c: readonly number[], at = 0) => ({
  x: c[at]!,
  y: c[at + 1]!,
  z: c[at + 2]!,
  w: c[at + 3]!,
});
const rectAt = (c: readonly number[]) => ({ x: c[0]!, y: c[1]!, w: c[2]!, h: c[3]! });
const rect = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => [x, y, w, h];

const layout = <T extends MathTypeName>(
  component: ComponentType,
  count: number,
  flat: MathLayout<T>['flat'],
  fromFlat: MathLayout<T>['fromFlat']
): MathLayout<T> => ({ component, count, flat, fromFlat });

export const MATH_LAYOUT: { readonly [T in MathTypeName]: MathLayout<T> } = {
  VECTOR2: layout('real', 2, xy, vector2At),
  VECTOR2I: layout('int32', 2, xy, vector2At),
  RECT2: layout('real', 4, rect, rectAt),
  RECT2I: layout('int32', 4, rect, rectAt),
  VECTOR3: layout('real', 3, xyz, vector3At),
  VECTOR3I: layout('int32', 3, xyz, vector3At),
  TRANSFORM2D: layout(
    'real',
    6,
    ({ a, b, c, d, tx, ty }) => [a, b, c, d, tx, ty],
    ([a, b, c, d, tx, ty]) => ({ a: a!, b: b!, c: c!, d: d!, tx: tx!, ty: ty! })
  ),
  VECTOR4: layout('real', 4, xyzw, vector4At),
  VECTOR4I: layout('int32', 4, xyzw, vector4At),
  PLANE: layout(
    'real',
    4,
    ({ normal, d }) => [...xyz(normal), d],
    (c) => ({ normal: vector3At(c), d: c[3]! })
  ),
  QUATERNION: layout('real', 4, xyzw, vector4At),
  AABB: layout(
    'real',
    6,
    ({ position, size }) => [...xyz(position), ...xyz(size)],
    (c) => ({ position: vector3At(c), size: vector3At(c, 3) })
  ),
  BASIS: layout(
    'real',
    9,
    (basis) => [...basis],
    (c) => [...c] as unknown as BasisComponents
  ),
  TRANSFORM3D: layout(
    'real',
    12,
    ({ basis_x, basis_y, basis_z, origin }) => [basis_x, basis_y, basis_z, origin].flatMap(xyz),
    (c) => ({
      basis_x: vector3At(c),
      basis_y: vector3At(c, 3),
      basis_z: vector3At(c, 6),
      origin: vector3At(c, 9),
    })
  ),
  PROJECTION: layout(
    'real',
    16,
    (columns) => columns.flatMap(xyzw),
    (c) => [vector4At(c), vector4At(c, 4), vector4At(c, 8), vector4At(c, 12)]
  ),
  COLOR: layout(
    'float',
    4,
    ({ r, g, b, a }) => [r, g, b, a],
    ([r, g, b, a]) => ({ r: r!, g: g!, b: b!, a: a! })
  ),
};

export const VECTOR_TYPES = ['VECTOR2', 'VECTOR2I', 'VECTOR3', 'VECTOR3I', 'VECTOR4', 'VECTOR4I'] as const;
export type VectorTypeName = (typeof VECTOR_TYPES)[number];
export const isVectorType = (type: string): type is VectorTypeName =>
  (VECTOR_TYPES as readonly string[]).includes(type);

export const MATH_TYPES = Object.keys(MATH_LAYOUT) as MathTypeName[];

export const isMathType = (type: string): type is MathTypeName => Object.hasOwn(MATH_LAYOUT, type);

export type StructVariant = Extract<Variant, { type: MathTypeName }>;

export const isStructVariant = (value: Variant): value is StructVariant => isMathType(value.type);

/** The components of a math value, in its struct's memory order. */
export const componentsOf = (value: StructVariant): number[] =>
  (MATH_LAYOUT[value.type] as MathLayout<MathTypeName>).flat(value.value as never);

/** The math value of `type` with these components, in its struct's memory order. */
export const structOf = (type: MathTypeName, components: readonly number[]): StructVariant =>
  ({ type, value: (MATH_LAYOUT[type] as MathLayout<MathTypeName>).fromFlat(components) }) as StructVariant;

/** The struct each element of a packed array of structs holds. */
export const PACKED_STRUCT: Readonly<Record<string, MathTypeName>> = {
  PACKED_VECTOR2_ARRAY: 'VECTOR2',
  PACKED_VECTOR3_ARRAY: 'VECTOR3',
  PACKED_COLOR_ARRAY: 'COLOR',
  PACKED_VECTOR4_ARRAY: 'VECTOR4',
};

/** The components of every element of a packed array of structs, joined. */
export const packedComponents = (type: string, elements: readonly unknown[]): number[] => {
  const { flat } = MATH_LAYOUT[PACKED_STRUCT[type]!] as MathLayout<MathTypeName>;
  return elements.flatMap((element) => flat(element as never));
};
