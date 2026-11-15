import {
  propertyDescriptor,
  type PropertyDescriptor,
  type PropertyFacts,
} from '../godot/classdb/propertyDescriptor.js';
import { parseHintEnum, parseHintFlags } from '../godot/classdb/enumHint.js';
import { PROPERTY_HINT } from '../godot/classdb/propertyHint.js';
import { valueTypeOf } from '../godot/classdb/classProperty.js';
import { parseRangeHint, type RangeHintBounds } from '../godot/classdb/rangeHint.js';
import { isRuntimeHandle, VARIANT_TYPE } from '../godot/variant/variantType.js';
import type { IntWidth } from '../godot/variant/intWidth.js';
import type { PropertyValidator } from './propertyValidator.js';
import { v, type Grounding } from './validators/v.js';
import { layerBitmask } from './validators/layerBitmask.js';
import { hintedBitField } from './validators/maskedBitField.js';
import { RADIAN_ROUNDTRIP_EPSILON } from './validators/v/floats.js';
import type { EndedGrounding } from './validators/v/grounding.js';
import { degToRad } from '../godot/math/math.js';

// 32 layers: `-1` and `4294967295` are both the full mask.
const LAYER_MASK_WIDTH: IntWidth = 'uint32';

const PACKED_FLOAT_EXAMPLE = '0, 1';
const PACKED_STRING_EXAMPLE = '"a", "b"';

// A type absent here gets no check.
const FORMAT_CHECKS: Readonly<Partial<Record<number, (name: string) => PropertyValidator>>> = {
  [VARIANT_TYPE.NIL]: () => v.any(),
  [VARIANT_TYPE.BOOL]: v.boolean,
  [VARIANT_TYPE.STRING]: v.quotedString,
  [VARIANT_TYPE.VECTOR2I]: v.vector2i,
  [VARIANT_TYPE.RECT2]: v.rect2,
  [VARIANT_TYPE.RECT2I]: v.rect2i,
  [VARIANT_TYPE.VECTOR3I]: v.vector3i,
  [VARIANT_TYPE.TRANSFORM2D]: v.transform2d,
  [VARIANT_TYPE.VECTOR4]: v.vector4,
  [VARIANT_TYPE.PLANE]: v.plane,
  [VARIANT_TYPE.QUATERNION]: v.quaternion,
  [VARIANT_TYPE.AABB]: v.aabb,
  [VARIANT_TYPE.BASIS]: v.basis,
  [VARIANT_TYPE.TRANSFORM3D]: v.transform3d,
  [VARIANT_TYPE.COLOR]: v.color,
  [VARIANT_TYPE.STRING_NAME]: v.stringName,
  [VARIANT_TYPE.NODE_PATH]: v.nodePath,
  [VARIANT_TYPE.DICTIONARY]: v.dictionary,
  [VARIANT_TYPE.PACKED_BYTE_ARRAY]: v.packedByteArray,
  [VARIANT_TYPE.PACKED_INT32_ARRAY]: v.packedInt32Array,
  [VARIANT_TYPE.PACKED_INT64_ARRAY]: v.packedInt64Array,
  [VARIANT_TYPE.PACKED_FLOAT32_ARRAY]: (name) => v.packedFloat32Array(name, PACKED_FLOAT_EXAMPLE),
  [VARIANT_TYPE.PACKED_FLOAT64_ARRAY]: (name) => v.packedFloat64Array(name, PACKED_FLOAT_EXAMPLE),
  [VARIANT_TYPE.PACKED_STRING_ARRAY]: (name) => v.packedStringArray(name, PACKED_STRING_EXAMPLE),
  [VARIANT_TYPE.PACKED_VECTOR2_ARRAY]: v.packedVector2Array,
  [VARIANT_TYPE.PACKED_VECTOR3_ARRAY]: v.packedVector3Array,
  [VARIANT_TYPE.PACKED_COLOR_ARRAY]: v.packedColorArray,
};

const LAYER_HINTS: ReadonlySet<number> = new Set([
  PROPERTY_HINT.LAYERS_2D_RENDER,
  PROPERTY_HINT.LAYERS_2D_PHYSICS,
  PROPERTY_HINT.LAYERS_2D_NAVIGATION,
  PROPERTY_HINT.LAYERS_3D_RENDER,
  PROPERTY_HINT.LAYERS_3D_PHYSICS,
  PROPERTY_HINT.LAYERS_3D_NAVIGATION,
  PROPERTY_HINT.LAYERS_AVOIDANCE,
]);

type Ends = Pick<RangeHintBounds, 'min' | 'max'>;

function rangeOf({ hint, hintString }: PropertyDescriptor['property']): RangeHintBounds | undefined {
  return hint === PROPERTY_HINT.RANGE ? parseRangeHint(hintString) : undefined;
}

function citeEnds(cite: string, ends: Ends): Grounding['hinted'] {
  const hasMin = ends.min !== undefined;
  const hasMax = ends.max !== undefined;
  if (hasMin && hasMax) return cite;
  if (hasMin) return { min: cite };
  if (hasMax) return { max: cite };
  return undefined;
}

// A setter with no end of its own refuses at the hint's ends; one with an end keeps the hint's warning.
function grounding({ cite, facts }: PropertyDescriptor, ends: Ends): EndedGrounding {
  const hinted = citeEnds(cite, ends);
  const setter = facts?.setter;
  if (!setter) return { hinted };
  if (!setter.min && !setter.max) return { enforced: setter.cite };
  return {
    hinted,
    enforced: citeEnds(setter.cite, { min: setter.min?.at, max: setter.max?.at }),
    enforcedMin: setter.min,
    enforcedMax: setter.max,
  };
}

// Throws rather than drop a fact in silence.
function refuseFacts(descriptor: PropertyDescriptor, allowed: readonly (keyof PropertyFacts)[]): void {
  const stated = Object.keys(descriptor.facts ?? {}) as (keyof PropertyFacts)[];
  const unplaced = stated.filter((fact) => !allowed.includes(fact));
  if (unplaced.length === 0) return;
  const { declaredBy, name } = descriptor.property;
  throw new Error(
    `the hand row of ${declaredBy}.${name} states ${unplaced.join(', ')}, which its check cannot carry`
  );
}

function enumLabels(descriptor: PropertyDescriptor): { values: number[]; labels: Record<number, string> } {
  const entries = parseHintEnum(descriptor.property.hintString);
  const labels: Record<number, string> = {};
  for (const { label, value } of entries) labels[value] = descriptor.facts?.labels?.[value] ?? label;
  return { values: entries.map(({ value }) => value), labels };
}

function isContiguous(sorted: readonly number[]): boolean {
  return sorted.every((value, i) => i === 0 || value === sorted[i - 1]! + 1);
}

function enumValidator(descriptor: PropertyDescriptor): PropertyValidator {
  refuseFacts(descriptor, ['setter', 'labels']);
  const name = descriptor.property.name;
  const { values, labels } = enumLabels(descriptor);
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const ends = { min: sorted[0], max: sorted.at(-1) };
  if (isContiguous(sorted)) return v.enumInt(name, ends.min!, ends.max!, labels, grounding(descriptor, ends));
  return v.enumSet(name, labels, grounding(descriptor, ends));
}

function flagLabelsOf(hintString: string): Record<number, string> {
  return Object.fromEntries(parseHintFlags(hintString).map(({ label, value }) => [value, label]));
}

function intValidator(descriptor: PropertyDescriptor): PropertyValidator {
  const { name, hint, hintString } = descriptor.property;
  const width = descriptor.facts?.width;
  // An empty enum hint is filled at run time (audio_stream_interactive.cpp:430, :494).
  if (hint === PROPERTY_HINT.ENUM && hintString.length > 0) return enumValidator(descriptor);
  if (hint === PROPERTY_HINT.FLAGS) {
    refuseFacts(descriptor, []);
    return hintedBitField(name, { hinted: descriptor.cite, labels: flagLabelsOf(hintString) });
  }
  if (LAYER_HINTS.has(hint)) {
    refuseFacts(descriptor, ['width']);
    return layerBitmask(name, { hinted: descriptor.cite, width: width ?? LAYER_MASK_WIDTH });
  }
  refuseFacts(descriptor, ['setter', 'width', 'message']);
  const { min, max } = rangeOf(descriptor.property) ?? {};
  return v.int(name, {
    min,
    max,
    width,
    message: descriptor.facts?.message,
    ...grounding(descriptor, { min, max }),
  });
}

function radianEnds(ends: Ends): Ends {
  return {
    min: ends.min === undefined ? undefined : degToRad(ends.min) - RADIAN_ROUNDTRIP_EPSILON,
    max: ends.max === undefined ? undefined : degToRad(ends.max) + RADIAN_ROUNDTRIP_EPSILON,
  };
}

function floatValidator(descriptor: PropertyDescriptor): PropertyValidator {
  const name = descriptor.property.name;
  const range = rangeOf(descriptor.property);
  if (range?.radiansAsDegrees) {
    refuseFacts(descriptor, []);
    if (range.min !== undefined && range.max !== undefined) {
      return v.radians(name, { minDeg: range.min, maxDeg: range.max, ...grounding(descriptor, range) });
    }
    const ends = radianEnds(range);
    return v.float(name, { ...ends, ...grounding(descriptor, ends) });
  }
  refuseFacts(descriptor, ['setter', 'message']);
  const { min, max } = range ?? {};
  return v.float(name, {
    min,
    max,
    message: descriptor.facts?.message,
    ...grounding(descriptor, { min, max }),
  });
}

function floatVectorValidator(
  descriptor: PropertyDescriptor,
  plain: (name: string) => PropertyValidator,
  bounded: typeof v.boundedVector3
): PropertyValidator {
  refuseFacts(descriptor, []);
  const name = descriptor.property.name;
  const range = rangeOf(descriptor.property);
  if (!range || (range.min === undefined && range.max === undefined)) return plain(name);
  return bounded(name, { min: range.min, max: range.max, ...grounding(descriptor, range) });
}

// `Font` from `24/17:Font`.
function arrayElementType(hintString: string): string {
  const colon = hintString.lastIndexOf(':');
  return colon === -1 ? hintString : hintString.slice(colon + 1);
}

function arrayValidator(descriptor: PropertyDescriptor): PropertyValidator {
  refuseFacts(descriptor, []);
  const { name, hint, hintString } = descriptor.property;
  if (hint !== PROPERTY_HINT.ARRAY_TYPE || hintString.length === 0) return v.arrayLiteral(name);
  return v.arrayLiteral(name, { typedAs: arrayElementType(hintString), hinted: descriptor.cite });
}

function objectValidator(descriptor: PropertyDescriptor): PropertyValidator {
  refuseFacts(descriptor, []);
  const { name, hint } = descriptor.property;
  if (hint === PROPERTY_HINT.NODE_TYPE) return v.nodePath(name, { orNull: true });
  return v.resourceReference(name);
}

export function descriptorValidator(descriptor: PropertyDescriptor): PropertyValidator | null {
  // Godot writes the getter's value and drops it on load (class_db.cpp:1655-1659).
  if (descriptor.property.isSetterless) {
    refuseFacts(descriptor, []);
    return v.any();
  }
  const valueType = valueTypeOf(descriptor.property);
  switch (valueType) {
    case VARIANT_TYPE.INT:
      return intValidator(descriptor);
    case VARIANT_TYPE.FLOAT:
      return floatValidator(descriptor);
    case VARIANT_TYPE.VECTOR2:
      return floatVectorValidator(descriptor, v.vector2, v.boundedVector2);
    case VARIANT_TYPE.VECTOR3:
      return floatVectorValidator(descriptor, v.vector3, v.boundedVector3);
    case VARIANT_TYPE.ARRAY:
      return arrayValidator(descriptor);
    case VARIANT_TYPE.OBJECT:
      return objectValidator(descriptor);
  }
  refuseFacts(descriptor, []);
  if (isRuntimeHandle(valueType)) return null;
  return FORMAT_CHECKS[valueType]?.(descriptor.property.name) ?? null;
}

export function derivedValidator(className: string, key: string): PropertyValidator | null {
  const descriptor = propertyDescriptor(className, key);
  return descriptor ? descriptorValidator(descriptor) : null;
}
