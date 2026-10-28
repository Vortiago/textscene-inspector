/**
 * The tint of a light's editor icon. Godot draws the icon in the light colour at full HSV value,
 * so a dim light still has a bright icon (`light_3d_gizmo_plugin.cpp:150-155`).
 */

import { colorHue, colorSaturation, hsvToRgb } from '../../../../godot/math/color';
import type { Rgba } from '../../../../godot/math/math';
import type { TscnNode } from '../../../../parser/types';
import { parseColor } from '../../../../utils/colorParser';
import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightProperties } from './types';

// The correlated colour is white unless physical light units are on, and this renderer does not
// apply it to the light either (`light_3d.cpp:257-262`), so the tint is the light colour alone.
export function lightIconModulate(light: TscnNode): Rgba {
  const color = parseColor((light.properties as Node3DProperties & BaseLightProperties).light_color);
  return hsvToRgb(colorHue(color), colorSaturation(color), 1);
}
