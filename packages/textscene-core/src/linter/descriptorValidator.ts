/**
 * The validator a property descriptor implies, for a key no hand validator answers. The Variant
 * type picks the format check that the hand validators of that type use, a range, enum, flags or
 * layers hint adds a warning bound (ADR-0032), and the hand row's setter fact raises an end to
 * the error tier. Every check is a `v` builder call, so no bound is checked twice.
 */

import type { PropertyDescriptor, PropertyFacts } from '../godot/classdb/propertyDescriptor.js';
import { parseHintEnum } from '../godot/classdb/enumHint.js';
import { PROPERTY_HINT } from '../godot/classdb/propertyHint.js';
import { parseRangeHint, type RangeHintBounds } from '../godot/classdb/rangeHint.js';
import { VARIANT_TYPE } from '../godot/variant/variantType.js';
import type { IntWidth } from '../godot/variant/intWidth.js';
import type { PropertyValidator } from './propertyValidator.js';
import { v, type Grounding } from './validators/v.js';
import { layerBitmask } from './validators/layerBitmask.js';
import { hintedBitField } from './validators/maskedBitField.js';
import { RADIAN_ROUNDTRIP_EPSILON } from './validators/v/floats.js';
import type { EndedGrounding } from './validators/v/grounding.js';
import { degToRad } from '../godot/math/math.js';

/**
 * `variant.h:248` stores an INT as `int64_t`. Which C++ type the setter takes is not in ClassDB,
 * so a derived slot reads at the Variant's own width, and a hand row's `width` narrows it.
 */
const VARIANT_INT_WIDTH: IntWidth = 'int64';

/** The example element a packed array's message shows. */
const PACKED_FLOAT_EXAMPLE = '0, 1';
const PACKED_STRING_EXAMPLE = '"a", "b"';

/** The format check of each Variant type that takes no bound. A type absent here gets no check. */
const FORMAT_CHECKS: Readonly<Partial<Record<number, (name: string) => PropertyValidator>>> = {
  [VARIANT_TYPE.NIL]: () => v.any(),
  [VARIANT_TYPE.BOOL]: v.boolean,
  [VARIANT_TYPE.STRING]: v.quotedString,
  [VARIANT_TYPE.VECTOR2]: (name) => v.vector2(name),
  [VARIANT_TYPE.VECTOR2I]: (name) => v.vector2i(name),
  [VARIANT_TYPE.RECT2]: v.rect2,
  [VARIANT_TYPE.RECT2I]: v.rect2i,
  [VARIANT_TYPE.VECTOR3]: (name) => v.vector3(name),
  [VARIANT_TYPE.TRANSFORM2D]: v.transform2d,
  [VARIANT_TYPE.PLANE]: v.plane,
  [VARIANT_TYPE.QUATERNION]: v.quaternion,
  [VARIANT_TYPE.AABB]: v.aabb,
  [VARIANT_TYPE.BASIS]: v.basis,
  [VARIANT_TYPE.TRANSFORM3D]: v.transform3d,
  [VARIANT_TYPE.COLOR]: v.color,
  [VARIANT_TYPE.STRING_NAME]: v.stringName,
  [VARIANT_TYPE.NODE_PATH]: (name) => v.nodePath(name),
  [VARIANT_TYPE.PACKED_FLOAT32_ARRAY]: (name) => v.packedFloat32Array(name, PACKED_FLOAT_EXAMPLE),
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

/** The ends a bound closes, before the setter's facts fold in. */
type Ends = Pick<RangeHintBounds, 'min' | 'max'>;

/** `cite` for each end `ends` closes, one string where both share it, as a hand validator spells it. */
function citeEnds(cite: string, ends: Ends): Grounding['hinted'] {
  const hasMin = ends.min !== undefined;
  const hasMax = ends.max !== undefined;
  if (hasMin && hasMax) return cite;
  if (hasMin) return { min: cite };
  if (hasMax) return { max: cite };
  return undefined;
}

/**
 * The grounding of a bound at `ends`: the capture's warning, or the setter's error. A setter
 * with no end of its own refuses what the hint excludes, so both hint ends error. A setter end
 * sits apart from the hint's, which keeps warning beside it.
 */
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

/** Throws where the hand row states a fact this check has no place for, which would drop it in silence. */
function refuseFacts(descriptor: PropertyDescriptor, allowed: readonly (keyof PropertyFacts)[]): void {
  const stated = Object.keys(descriptor.facts ?? {}) as (keyof PropertyFacts)[];
  const unplaced = stated.filter((fact) => !allowed.includes(fact));
  if (unplaced.length === 0) return;
  const { declaredBy, name } = descriptor.property;
  throw new Error(
    `the hand row of ${declaredBy}.${name} states ${unplaced.join(', ')}, which its check cannot carry`
  );
}

/** Value to label of an enum hint, with the hand row's constant names where it states them. */
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

/** Bit value to label of a flags hint: an implicit label takes bit `i` (`editor_properties.cpp:1018-1022`). */
function flagLabels(hintString: string): Record<number, string> {
  const labels: Record<number, string> = {};
  hintString.split(',').forEach((option, i) => {
    const [label, value] = option.trim().split(':');
    if (!label) return;
    labels[value === undefined ? 2 ** i : Number.parseInt(value, 10) || 0] = label;
  });
  return labels;
}

function intValidator(descriptor: PropertyDescriptor): PropertyValidator {
  const { name, hint, hintString } = descriptor.property;
  const width = descriptor.facts?.width ?? VARIANT_INT_WIDTH;
  if (hint === PROPERTY_HINT.ENUM) return enumValidator(descriptor);
  if (hint === PROPERTY_HINT.FLAGS) {
    refuseFacts(descriptor, []);
    return hintedBitField(name, { hinted: descriptor.cite, labels: flagLabels(hintString) });
  }
  if (LAYER_HINTS.has(hint)) {
    refuseFacts(descriptor, ['width']);
    return layerBitmask(name, { hinted: descriptor.cite, width });
  }
  refuseFacts(descriptor, ['setter', 'width', 'message']);
  const ends: Ends = (hint === PROPERTY_HINT.RANGE ? parseRangeHint(hintString) : undefined) ?? {};
  return v.int(name, {
    min: ends.min,
    max: ends.max,
    width,
    message: descriptor.facts?.message,
    ...grounding(descriptor, ends),
  });
}

/** The radian ends of a degree hint, widened as `v.radians` widens them. */
function radianEnds(ends: Ends): Ends {
  return {
    min: ends.min === undefined ? undefined : degToRad(ends.min) - RADIAN_ROUNDTRIP_EPSILON,
    max: ends.max === undefined ? undefined : degToRad(ends.max) + RADIAN_ROUNDTRIP_EPSILON,
  };
}

function floatValidator(descriptor: PropertyDescriptor): PropertyValidator {
  const { name, hint, hintString } = descriptor.property;
  const range = hint === PROPERTY_HINT.RANGE ? parseRangeHint(hintString) : undefined;
  if (range?.radiansAsDegrees) {
    refuseFacts(descriptor, []);
    if (range.min !== undefined && range.max !== undefined) {
      return v.radians(name, { minDeg: range.min, maxDeg: range.max, ...grounding(descriptor, range) });
    }
    const ends = radianEnds(range);
    return v.float(name, { ...ends, ...grounding(descriptor, ends) });
  }
  refuseFacts(descriptor, ['setter', 'message']);
  const ends: Ends = range ?? {};
  return v.float(name, {
    min: ends.min,
    max: ends.max,
    message: descriptor.facts?.message,
    ...grounding(descriptor, ends),
  });
}

function vector3Validator(descriptor: PropertyDescriptor): PropertyValidator {
  refuseFacts(descriptor, []);
  const { name, hint, hintString } = descriptor.property;
  const range = hint === PROPERTY_HINT.RANGE ? parseRangeHint(hintString) : undefined;
  if (!range || (range.min === undefined && range.max === undefined)) return v.vector3(name);
  return v.boundedVector3(name, { min: range.min, max: range.max, ...grounding(descriptor, range) });
}

/** `Font` from `24/17:Font`, or `Image` from a bare class name: the element type the hint names. */
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
  // A `.tscn` stores a node only as a path to it (`Control.shortcut_context`).
  if (hint === PROPERTY_HINT.NODE_TYPE) return v.nodePath(name, { orNull: true });
  return v.resourceReference(name);
}

/** The check `descriptor` implies, or null for a Variant type with none. */
export function descriptorValidator(descriptor: PropertyDescriptor): PropertyValidator | null {
  switch (descriptor.property.type) {
    case VARIANT_TYPE.INT:
      return intValidator(descriptor);
    case VARIANT_TYPE.FLOAT:
      return floatValidator(descriptor);
    case VARIANT_TYPE.VECTOR3:
      return vector3Validator(descriptor);
    case VARIANT_TYPE.ARRAY:
      return arrayValidator(descriptor);
    case VARIANT_TYPE.OBJECT:
      return objectValidator(descriptor);
  }
  refuseFacts(descriptor, []);
  return FORMAT_CHECKS[descriptor.property.type]?.(descriptor.property.name) ?? null;
}
