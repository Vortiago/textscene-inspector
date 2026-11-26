import { findClassProperty, valueTypeOf } from '../../godot/classdb/classProperty.js';
import { PROPERTY_HINT } from '../../godot/classdb/propertyHint.js';
import { booleanize } from '../../godot/variant/compare.js';
import { wrapInt32 } from '../../godot/variant/cInteger.js';
import { castVariant, toFloat32, toInt32, toInt64 } from '../../godot/variant/construct/variantCast.js';
import { textToVariant } from '../../godot/variant/reader/variantReader.js';
import { componentsOf, type StructVariant } from '../../godot/variant/value/mathLayout.js';
import type { Variant } from '../../godot/variant/value/variant.js';
import { VARIANT_TYPE } from '../../godot/variant/variantType.js';
import type { MaterialSettings, MaterialValue } from './materialProperties.js';

/** The lane types a BaseMaterial3D setter takes, by its argument's `Variant::Type`. */
const LANE_TYPES = {
  [VARIANT_TYPE.VECTOR2]: 'VECTOR2',
  [VARIANT_TYPE.VECTOR3]: 'VECTOR3',
  [VARIANT_TYPE.COLOR]: 'COLOR',
} as const;

/** The value a BaseMaterial3D setter takes from `value`, or nothing for a property no setter takes. */
function settingOf(name: string, value: Variant): MaterialValue | undefined {
  const property = findClassProperty('BaseMaterial3D', name);
  if (!property) return undefined;
  // A failed type check still calls the setter with `Variant::operator T` (`binder_common.h:175`).
  const type = valueTypeOf(property);
  if (type === VARIANT_TYPE.BOOL) return booleanize(value);
  if (type === VARIANT_TYPE.FLOAT) return toFloat32(value);
  // An enum casts through `int64_t` (`VARIANT_ENUM_CAST`), an `int` through `int32_t`.
  if (type === VARIANT_TYPE.INT)
    return property.hint === PROPERTY_HINT.ENUM ? wrapInt32(toInt64(value)) : toInt32(value);
  const laneType = Object.hasOwn(LANE_TYPES, type) ? LANE_TYPES[type as keyof typeof LANE_TYPES] : undefined;
  return laneType && componentsOf(castVariant(value, laneType) as StructVariant);
}

/** The settings of a material whose file writes each property as Variant text, in the file's order. */
export function materialSettingsOf(properties: Readonly<Record<string, string>>): MaterialSettings {
  const settings: Record<string, MaterialValue> = {};
  for (const [name, text] of Object.entries(properties)) {
    const setting = settingOf(name, textToVariant(text));
    if (setting !== undefined) settings[name] = setting;
  }
  return settings;
}
