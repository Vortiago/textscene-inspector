import { textToVariant } from '../../godot/variant/reader/variantReader.js';
import type { Variant } from '../../godot/variant/value/variant.js';
import type { MaterialSettings, MaterialValue } from './materialProperties.js';

/** The value a setter takes from `value`, or nothing for a Variant no BaseMaterial3D setter takes. */
function settingOf(value: Variant): MaterialValue | undefined {
  switch (value.type) {
    case 'BOOL':
      return value.value;
    case 'INT':
      return Number(value.value);
    case 'FLOAT':
      return value.value;
    case 'COLOR':
      return [value.value.r, value.value.g, value.value.b, value.value.a];
    case 'VECTOR2':
      return [value.value.x, value.value.y];
    case 'VECTOR3':
      return [value.value.x, value.value.y, value.value.z];
    default:
      return undefined;
  }
}

/** The settings of a material whose file writes each property as Variant text, in the file's order. */
export function materialSettingsOf(properties: Readonly<Record<string, string>>): MaterialSettings {
  const settings: Record<string, MaterialValue> = {};
  for (const [name, text] of Object.entries(properties)) {
    const setting = settingOf(textToVariant(text));
    if (setting !== undefined) settings[name] = setting;
  }
  return settings;
}
