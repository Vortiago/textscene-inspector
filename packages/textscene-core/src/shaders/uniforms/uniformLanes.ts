import { srgbToLinear } from '../../godot/math/color.js';
import { booleanize } from '../../godot/variant/compare.js';
import { doubleToInt32 } from '../../godot/variant/cInteger.js';
import { castVariant, toFloat32, toInt32, toUint32 } from '../../godot/variant/construct/variantCast.js';
import { componentsOf, structOf, type StructVariant } from '../../godot/variant/value/mathLayout.js';
import { isPackedType, packedElements } from '../../godot/variant/value/packedElements.js';
import { variant, type Variant, type VariantTypeName } from '../../godot/variant/value/variant.js';
import type { Scalar, UniformNode, ValueType } from '../language/shaderTree.js';
import { shapeOf, type ScalarKind } from '../language/types.js';

/** A uniform's lanes: each element's lanes, a matrix's columns one after the other, a bool as 0 or 1. */
export type Lanes = number[];

const BLACK = variant('COLOR', { r: 0, g: 0, b: 0, a: 1 });

const identityOf = (size: number) =>
  Array.from({ length: size * size }, (_, lane) => (lane % (size + 1) === 0 ? 1 : 0));

/** The identity each matrix type takes when the material has no value (`material_storage.cpp:813`). */
const IDENTITY: Readonly<Record<string, Variant>> = {
  mat2: structOf('TRANSFORM2D', [1, 0, 0, 1, 0, 0]),
  mat3: structOf('BASIS', identityOf(3)),
  mat4: structOf('PROJECTION', identityOf(4)),
};

/** The lanes of a uniform the material gives no value (`material_storage.cpp:804`). */
export function defaultLanes(uniform: UniformNode, useLinearColor: boolean): Lanes {
  if (uniform.defaultValue) return constantLanes(uniform, uniform.defaultValue, useLinearColor);
  const arraySize = uniform.arraySize ?? 0;
  const isColor = uniform.type === 'vec3' || uniform.type === 'vec4';
  if (isColor && uniform.hint === 'source_color')
    return valueLanes(uniform.type, arraySize, BLACK, useLinearColor);
  if (isColor && uniform.hint === 'color_conversion_disabled')
    return valueLanes(uniform.type, arraySize, BLACK, false);
  const identity = IDENTITY[uniform.type];
  if (identity) return valueLanes(uniform.type, arraySize, identity, false);
  return new Array<number>(laneCount(uniform.type) * Math.max(1, arraySize)).fill(0);
}

/** The lanes of the material's value of a uniform (`material_storage.cpp:799`). */
export function materialLanes(uniform: UniformNode, value: Variant, useLinearColor: boolean): Lanes {
  const isLinear = useLinearColor && uniform.hint !== 'color_conversion_disabled';
  return valueLanes(uniform.type, uniform.arraySize ?? 0, value, isLinear);
}

/** `_fill_std140_ubo_value` (`material_storage.cpp:347`): a source colour default goes to linear. */
function constantLanes(uniform: UniformNode, values: readonly Scalar[], useLinearColor: boolean): Lanes {
  const lanes = values.map(Number);
  const isColor = uniform.type === 'vec3' || uniform.type === 'vec4';
  if (!isColor || uniform.hint !== 'source_color' || !useLinearColor) return lanes;
  return lanes.map((lane, index) => (index < 3 ? srgbToLinear(lane) : lane));
}

const laneCount = (type: ValueType) => shapeOf(type)!.lanes;

/** `_fill_std140_variant_ubo_value` (`material_storage.cpp:45`) without the std140 padding. */
function valueLanes(type: ValueType, arraySize: number, value: Variant, isLinear: boolean): Lanes {
  if (arraySize > 0) return arrayLanes(type, arraySize, value, isLinear);
  const { scalar, lanes, columns } = shapeOf(type)!;
  if (columns !== undefined) return matrixLanes(type, value);
  if (lanes === 1) return [scalarLane(scalar, value)];
  if (scalar === 'bool') return maskLanes(toUint32(value), lanes);
  return vectorLanes(value, lanes, scalar, isLinear && takesColor(scalar, lanes));
}

/** Only a `vec3` or `vec4` passes `p_linear_color` on to `convert_to_vector`. */
const takesColor = (scalar: ScalarKind, lanes: number) => scalar === 'float' && lanes >= 3;

/** `bool v = value`, `int v = value` or `float v = value`; a `uint` is the bits of an `int`. */
function scalarLane(scalar: ScalarKind, value: Variant): number {
  switch (scalar) {
    case 'bool':
      return booleanize(value) ? 1 : 0;
    case 'int':
      return toInt32(value);
    case 'uint':
      return toInt32(value) >>> 0;
    case 'float':
      return toFloat32(value);
  }
}

/** A `bvec` takes the low bits of `uint32_t v = value`, lane 0 from bit 0. */
const maskLanes = (mask: number, lanes: number): Lanes =>
  Array.from({ length: lanes }, (_, lane) => (mask >>> lane) & 1);

/** The column-major lanes of a `Transform2D`, `Basis` or `Projection` (`variant_converters.h:85`). */
function matrixLanes(type: ValueType, value: Variant): Lanes {
  if (type === 'mat2') return componentsOf(castVariant(value, 'TRANSFORM2D') as StructVariant).slice(0, 4);
  if (type === 'mat3') return basisColumns(componentsOf(castVariant(value, 'BASIS') as StructVariant));
  return componentsOf(castVariant(value, 'PROJECTION') as StructVariant);
}

/** A Basis holds its rows, and std140 its columns. */
const basisColumns = (rows: readonly number[]): Lanes =>
  Array.from({ length: 9 }, (_, lane) => rows[(lane % 3) * 3 + Math.floor(lane / 3)]!);

/** The Variant types `convert_to_vector` reads component by component (`variant_converters.h:196`). */
const STRUCT_SOURCES: ReadonlySet<string> = new Set(['QUATERNION', 'PLANE', 'RECT2', 'RECT2I', 'COLOR']);

const VECTOR_TYPES: Readonly<Record<'float' | 'int', readonly VariantTypeName[]>> = {
  float: ['VECTOR2', 'VECTOR3', 'VECTOR4'],
  int: ['VECTOR2I', 'VECTOR3I', 'VECTOR4I'],
};

/** `convert_to_vector<T>`: a `uvec` reads a `Vector2i` and keeps the bits of each component. */
function vectorLanes(value: Variant, lanes: number, scalar: ScalarKind, isLinear: boolean): Lanes {
  const isFloat = scalar === 'float';
  const components = vectorComponents(value, lanes, isFloat, isLinear);
  const lane = isFloat ? Math.fround : doubleToInt32;
  return components.map((component) => (scalar === 'uint' ? lane(component) >>> 0 : lane(component)));
}

function vectorComponents(value: Variant, lanes: number, isFloat: boolean, isLinear: boolean): number[] {
  if (STRUCT_SOURCES.has(value.type)) {
    const components = componentsOf(value as StructVariant).map(Math.fround);
    if (value.type === 'COLOR' && isLinear)
      components.splice(0, 3, ...components.slice(0, 3).map(srgbToLinear));
    return padded(components.slice(0, lanes), lanes);
  }
  if (value.type === 'ARRAY' || isPackedType(value.type)) {
    const elements = elementsOf(value).slice(0, lanes);
    return padded(
      elements.map((element) => (isFloat ? toFloat32(element) : toInt32(element))),
      lanes
    );
  }
  const vectorType = VECTOR_TYPES[isFloat ? 'float' : 'int'][lanes - 2]!;
  return componentsOf(castVariant(value, vectorType) as StructVariant);
}

const padded = (components: readonly number[], lanes: number): number[] => [
  ...components,
  ...new Array<number>(lanes - components.length).fill(0),
];

const elementsOf = (value: Variant): readonly Variant[] =>
  value.type === 'ARRAY' ? value.value : packedElements(value);

/** The packed types `convert_array_std140` reads element by element (`variant_converters.h:238`). */
const CONVERTIBLE_ARRAYS: ReadonlySet<string> = new Set([
  'ARRAY',
  'PACKED_VECTOR2_ARRAY',
  'PACKED_VECTOR3_ARRAY',
  'PACKED_COLOR_ARRAY',
  'PACKED_VECTOR4_ARRAY',
]);

/** An array uniform: each element converted, then `write_array_std140` fills a missing one. */
function arrayLanes(type: ValueType, arraySize: number, value: Variant, isLinear: boolean): Lanes {
  const { scalar, lanes, columns } = shapeOf(type)!;
  if (type === 'mat2') return written(packedFloats(value), arraySize, 4, IDENTITY_LANES.mat2!);
  if (columns !== undefined) {
    const items = convertedArray(value, (item) => matrixLanes(type, item), 'PACKED_FLOAT32_ARRAY');
    return written(items, arraySize, lanes, IDENTITY_LANES[type]!);
  }
  if (lanes === 1) return written(scalarArray(scalar, value), arraySize, 1, [0]);
  const isFloat = scalar === 'float';
  const items = convertedArray(
    value,
    (item) => vectorComponents(item, lanes, isFloat, isLinear && takesColor(scalar, lanes)),
    isFloat ? 'PACKED_FLOAT32_ARRAY' : 'PACKED_INT32_ARRAY'
  );
  const filled = written(items, arraySize, lanes, new Array<number>(lanes).fill(0));
  if (scalar === 'bool') return filled.map((lane) => (lane !== 0 ? 1 : 0));
  return scalar === 'uint' ? filled.map((lane) => lane >>> 0) : filled;
}

const IDENTITY_LANES: Readonly<Record<string, Lanes>> = Object.fromEntries(
  Object.entries(IDENTITY).map(([type, value]) => [type, matrixLanes(type, value)])
);

const packedFloats = (value: Variant): number[] => [
  ...(castVariant(value, 'PACKED_FLOAT32_ARRAY').value as readonly number[]),
];

const packedInts = (value: Variant): number[] => [
  ...(castVariant(value, 'PACKED_INT32_ARRAY').value as readonly number[]),
];

/** `PackedInt32Array` or `PackedFloat32Array` of the value; a `bool` element is 1 when it is not 0. */
function scalarArray(scalar: ScalarKind, value: Variant): number[] {
  if (scalar === 'float') return packedFloats(value);
  const ints = packedInts(value);
  if (scalar === 'bool') return ints.map((lane) => (lane !== 0 ? 1 : 0));
  return scalar === 'uint' ? ints.map((lane) => lane >>> 0) : ints;
}

/** `convert_array_std140` (`variant_converters.h:256`): numbers as `packed`, else each converted. */
function convertedArray(
  value: Variant,
  convert: (item: Variant) => number[],
  packed: 'PACKED_FLOAT32_ARRAY' | 'PACKED_INT32_ARRAY'
): number[] {
  if (CONVERTIBLE_ARRAYS.has(value.type)) {
    const items = elementsOf(value);
    if (items.every((item) => item.type === 'INT' || item.type === 'FLOAT'))
      return packed === 'PACKED_FLOAT32_ARRAY' ? packedFloats(value) : packedInts(value);
    return items.flatMap(convert);
  }
  if (isPackedType(value.type))
    return packed === 'PACKED_FLOAT32_ARRAY' ? packedFloats(value) : packedInts(value);
  return [];
}

/** `write_array_std140` (`variant_converters.h:293`): only whole elements copy, a missing one is `fill`. */
function written(source: readonly number[], arraySize: number, size: number, fill: Lanes): Lanes {
  return Array.from({ length: arraySize }, (_, index) => {
    const start = index * size;
    return start + size <= source.length ? source.slice(start, start + size) : fill;
  }).flat();
}
