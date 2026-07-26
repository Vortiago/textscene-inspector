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
   * Godot's particle-sheet animation, which only a particles node drives.
   * Parsed so the inspector and linter see it; it has no renderer consumer
   * because CPUParticles2D/GPUParticles2D are not implemented.
   */
  particlesAnimation: boolean;
  particlesAnimHFrames: number;
  particlesAnimVFrames: number;
  particlesAnimLoop: boolean;
}
