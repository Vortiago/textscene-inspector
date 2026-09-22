/** TextureButton parser — Control + its own five texture slots, ignore_texture_size, stretch_mode, flip_h/flip_v, plus BaseButton's disabled/button_pressed (TextureButton derives from BaseButton directly, not Button — texture_button.h:35). */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { TextureButtonProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue } from '../../../../godot/index.js';

export function parseTextureButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): TextureButtonProperties {
  const result: TextureButtonProperties = { ...parseControl(heading, properties) };
  if (properties.texture_normal !== undefined) result.textureNormal = properties.texture_normal;
  if (properties.texture_pressed !== undefined) result.texturePressed = properties.texture_pressed;
  if (properties.texture_hover !== undefined) result.textureHover = properties.texture_hover;
  if (properties.texture_disabled !== undefined) result.textureDisabled = properties.texture_disabled;
  if (properties.texture_focused !== undefined) result.textureFocused = properties.texture_focused;
  result.ignoreTextureSize = boolSlotValue(properties.ignore_texture_size) === true;
  result.stretchMode = parseOptionalInt(properties.stretch_mode);
  result.flipH = boolSlotValue(properties.flip_h) === true;
  result.flipV = boolSlotValue(properties.flip_v) === true;
  result.disabled = boolSlotValue(properties.disabled) === true;
  result.buttonPressed = boolSlotValue(properties.button_pressed) === true;
  return result;
}
