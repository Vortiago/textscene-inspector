/**
 * `CanvasItemMaterial` sub-resource parser. Godot defaults (class_canvasitemmaterial.html):
 * blend_mode MIX, light_mode NORMAL, particles_animation off with 1×1 frames
 * and no loop.
 */

import { boolOr, enumOr, intOr } from '../../../parser/valueParsers';
import {
  CanvasItemBlendMode,
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from './types';

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

export function parseCanvasItemMaterial(
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
