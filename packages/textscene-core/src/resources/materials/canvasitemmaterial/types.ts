/**
 * `CanvasItemMaterial` — the material every 2D CanvasItem can carry. It holds
 * no textures of its own: it selects how the item's pixels are COMBINED with
 * what is already on the canvas (`blend_mode`) and whether 2D lights reach them
 * (`light_mode`).
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
  /** Drawn ONLY where a 2D light reaches it. */
  LIGHT_ONLY = 2,
}

export interface CanvasItemMaterialProperties {
  blendMode: CanvasItemBlendMode;
  lightMode: CanvasItemLightMode;
  /**
   * Godot's particle-sheet animation: the texture is a sheet of `h × v` cells
   * and each particle draws ONE of them, picked by the anim value the emitter
   * carries (`INSTANCE_CUSTOM.z`). Consumed by CPUParticles2D's geometry
   * builder, which shrinks the quad and windows its UVs exactly as the vertex
   * shader `_update_shader()` generates does. GPUParticles2D does not render at
   * all, so a sheet on one of those is still inert.
   */
  particlesAnimation: boolean;
  particlesAnimHFrames: number;
  particlesAnimVFrames: number;
  particlesAnimLoop: boolean;
}
