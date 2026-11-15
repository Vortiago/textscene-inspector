/** The value each Variant type's C++ default constructor gives, as `Variant::construct` with no arguments makes it. */

import { variant, type Variant, type VariantTypeName, type VariantValues } from './variant.js';

const ZERO2 = { x: 0, y: 0 };
const ZERO3 = { x: 0, y: 0, z: 0 };
const ZERO4 = { x: 0, y: 0, z: 0, w: 0 };
const IDENTITY_TRANSFORM3D = {
  basis_x: { x: 1, y: 0, z: 0 },
  basis_y: { x: 0, y: 1, z: 0 },
  basis_z: { x: 0, y: 0, z: 1 },
  origin: ZERO3,
};

const DEFAULTS: { readonly [T in VariantTypeName]: VariantValues[T] } = {
  NIL: null,
  BOOL: false,
  INT: 0n,
  FLOAT: 0,
  STRING: '',
  VECTOR2: ZERO2,
  VECTOR2I: ZERO2,
  RECT2: { x: 0, y: 0, w: 0, h: 0 },
  RECT2I: { x: 0, y: 0, w: 0, h: 0 },
  VECTOR3: ZERO3,
  VECTOR3I: ZERO3,
  TRANSFORM2D: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
  VECTOR4: ZERO4,
  VECTOR4I: ZERO4,
  PLANE: { normal: ZERO3, d: 0 },
  QUATERNION: { x: 0, y: 0, z: 0, w: 1 },
  AABB: { position: ZERO3, size: ZERO3 },
  BASIS: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  TRANSFORM3D: IDENTITY_TRANSFORM3D,
  PROJECTION: [
    { x: 1, y: 0, z: 0, w: 0 },
    { x: 0, y: 1, z: 0, w: 0 },
    { x: 0, y: 0, z: 1, w: 0 },
    { x: 0, y: 0, z: 0, w: 1 },
  ],
  COLOR: { r: 0, g: 0, b: 0, a: 1 },
  STRING_NAME: '',
  NODE_PATH: '',
  RID: 0n,
  OBJECT: null,
  CALLABLE: null,
  SIGNAL: null,
  DICTIONARY: [],
  ARRAY: [],
  PACKED_BYTE_ARRAY: [],
  PACKED_INT32_ARRAY: [],
  PACKED_INT64_ARRAY: [],
  PACKED_FLOAT32_ARRAY: [],
  PACKED_FLOAT64_ARRAY: [],
  PACKED_STRING_ARRAY: [],
  PACKED_VECTOR2_ARRAY: [],
  PACKED_VECTOR3_ARRAY: [],
  PACKED_COLOR_ARRAY: [],
  PACKED_VECTOR4_ARRAY: [],
};

export function defaultValue<T extends VariantTypeName>(type: T): Variant {
  return variant(type, DEFAULTS[type]) as Variant;
}
