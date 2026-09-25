/**
 * `CanvasItemMaterial`, the material every 2D CanvasItem can carry. It holds no textures:
 * it selects how the item's pixels combine with the canvas (`blend_mode`) and whether 2D
 * lights reach them (`light_mode`).
 */

/** Godot `CanvasItemMaterial.BlendMode`. */
export enum CanvasItemBlendMode {
  MIX = 0,
  ADD = 1,
  SUB = 2,
  MUL = 3,
  PREMULT_ALPHA = 4,
}

/** Godot `CanvasItemMaterial.LightMode`. */
export enum CanvasItemLightMode {
  /** Lit by 2D lights, as an unshaded base plus each light's contribution. */
  NORMAL = 0,
  /** Drawn at full albedo, untouched by any 2D light. */
  UNSHADED = 1,
  /** Drawn only where a 2D light reaches it. */
  LIGHT_ONLY = 2,
}

export interface CanvasItemMaterialProperties {
  blendMode: CanvasItemBlendMode;
  lightMode: CanvasItemLightMode;
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
