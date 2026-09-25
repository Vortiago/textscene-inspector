/**
 * `CanvasItemMaterial` decode: a property bag into typed data, with the defaults of
 * `scene/resources/canvas_item_material.cpp`. blend_mode MIX and light_mode NORMAL (cpp:268/274),
 * particles_animation off with 1×1 frames and no loop (the constructor, cpp:283-285).
 */

import { boolOr, enumOr, intOr } from '../../../parser/valueParsers';
import {
  CanvasItemBlendMode,
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from './types';

/**
 * The authorable blend modes. `BLEND_MODE_DISABLED` (5) is in the C++ enum
 * (canvas_item_material.h:45) but bound to neither the script API
 * (`BIND_ENUM_CONSTANT`, cpp:268-272) nor the inspector hint (cpp:260), so it reads as MIX.
 */
const BLEND_MODES = [
  CanvasItemBlendMode.MIX,
  CanvasItemBlendMode.ADD,
  CanvasItemBlendMode.SUB,
  CanvasItemBlendMode.MUL,
  CanvasItemBlendMode.PREMULT_ALPHA,
] as const;

const LIGHT_MODES = [
  CanvasItemLightMode.NORMAL,
  CanvasItemLightMode.UNSHADED,
  CanvasItemLightMode.LIGHT_ONLY,
] as const;

export function decodeCanvasItemMaterial(
  properties: Record<string, string>
): CanvasItemMaterialProperties {
  return {
    blendMode: enumOr(
      properties.blend_mode,
      CanvasItemBlendMode.MIX,
      BLEND_MODES,
      'CanvasItemMaterial.blend_mode'
    ),
    lightMode: enumOr(
      properties.light_mode,
      CanvasItemLightMode.NORMAL,
      LIGHT_MODES,
      'CanvasItemMaterial.light_mode'
    ),
    particlesAnimation: boolOr(properties.particles_animation, false, 'CanvasItemMaterial'),
    particlesAnimHFrames: intOr(properties.particles_anim_h_frames, 1, 'CanvasItemMaterial'),
    particlesAnimVFrames: intOr(properties.particles_anim_v_frames, 1, 'CanvasItemMaterial'),
    particlesAnimLoop: boolOr(properties.particles_anim_loop, false, 'CanvasItemMaterial'),
  };
}
