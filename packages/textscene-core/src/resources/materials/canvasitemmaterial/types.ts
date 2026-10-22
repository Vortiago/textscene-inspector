/**
 * `CanvasItemMaterial`, the material every 2D CanvasItem can carry. It holds no textures:
 * it selects how the item's pixels combine with the canvas (`blend_mode`) and whether 2D
 * lights reach them (`light_mode`).
 */

import type {
  CanvasItemMaterialBlendMode,
  CanvasItemMaterialLightMode,
} from '../../../godot/scene/canvasItemMaterial.js';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

export interface CanvasItemMaterialProperties {
  blendMode: EnumValue<typeof CanvasItemMaterialBlendMode>;
  lightMode: EnumValue<typeof CanvasItemMaterialLightMode>;
  /**
   * Godot's particle-sheet animation: each particle draws one of `h × v` cells, picked by
   * `INSTANCE_CUSTOM.z`. CPUParticles2D's geometry builder shrinks the quad and windows its
   * UVs as the vertex shader `_update_shader()` generates does. GPUParticles2D does not render.
   */
  particlesAnimation: boolean;
  particlesAnimHFrames: number;
  particlesAnimVFrames: number;
  particlesAnimLoop: boolean;
}
