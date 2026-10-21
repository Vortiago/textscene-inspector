/** The alpha antialiasing pair that Label3D and Sprite3D (SpriteBase3D) both store. */

import { floatOr, intOr } from './valueParsers';

/**
 * `set_alpha_antialiasing` stores any value (`label_3d.cpp:1058-1063`, `sprite_3d.cpp:571-578`), and
 * any but OFF ramps the edge. `contextPrefix` names the node in a parse warning.
 */
export function parseAlphaAntialiasing(properties: Record<string, string>, contextPrefix = '') {
  return {
    alpha_antialiasing_mode: intOr(
      properties.alpha_antialiasing_mode,
      0,
      `${contextPrefix}alpha_antialiasing_mode`
    ),
    alpha_antialiasing_edge: floatOr(
      properties.alpha_antialiasing_edge,
      0,
      `${contextPrefix}alpha_antialiasing_edge`
    ),
  };
}
