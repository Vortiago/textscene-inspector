/** The alpha antialiasing pair that Label3D and Sprite3D (SpriteBase3D) both store. */

import { AlphaAntiAliasing } from '../godot/rendering/materials/alphaAntialiasing';
import type { EnumValue } from '../godot/classdb/enumNames.js';
import { floatOr, intOr } from './valueParsers';

/**
 * `set_alpha_antialiasing` stores any value (`label_3d.cpp:1058-1063`, `sprite_3d.cpp:571-578`), and
 * any but OFF ramps the edge. `contextPrefix` names the node in a parse warning.
 */
export function parseAlphaAntialiasing(properties: Record<string, string>, contextPrefix = '') {
  return {
    alpha_antialiasing_mode: intOr(
      properties.alpha_antialiasing_mode,
      AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF,
      `${contextPrefix}alpha_antialiasing_mode`
    ) as EnumValue<typeof AlphaAntiAliasing>,
    alpha_antialiasing_edge: floatOr(
      properties.alpha_antialiasing_edge,
      0,
      `${contextPrefix}alpha_antialiasing_edge`
    ),
  };
}
