/**
 * The flipbook a CanvasItemMaterial with `particles_animation` gives a canvas item: the vertex shader
 * `canvas_item_material.cpp:117-134` generates. It shrinks the item to one cell and windows the UV
 * to the cell `INSTANCE_CUSTOM.z` picks. CPUParticles2D and the 2D mesh nodes share it.
 */

import { clamp, posmod } from '../godot/math/math';
import type { CanvasItemMaterialProperties } from '../resources/materials/canvasitemmaterial/types';

export interface ParticlesFlipbook {
  hFrames: number;
  vFrames: number;
  /** `particles_anim_loop`: wrap past the last cell instead of holding on it. */
  loop: boolean;
}

/** One cell of the sheet: the divisor of the item's size and UV, and the UV offset. */
export interface FlipbookCell {
  hFrames: number;
  vFrames: number;
  uOffset: number;
  vOffset: number;
}

/** What an item with no flipbook shows: the whole texture at its own size. */
const WHOLE_TEXTURE: FlipbookCell = { hFrames: 1, vFrames: 1, uOffset: 0, vOffset: 0 };

/** The material's flipbook, or null when it has none. */
export function particlesFlipbook(material: CanvasItemMaterialProperties | null): ParticlesFlipbook | null {
  if (!material?.particlesAnimation) return null;
  return {
    hFrames: material.particlesAnimHFrames,
    vFrames: material.particlesAnimVFrames,
    loop: material.particlesAnimLoop,
  };
}

/** The cell the vertex shader picks for `INSTANCE_CUSTOM.z`. A null flipbook is {@link WHOLE_TEXTURE}. */
export function flipbookCell(flipbook: ParticlesFlipbook | null, z: number): FlipbookCell {
  if (!flipbook) return WHOLE_TEXTURE;
  const hFrames = Math.max(1, Math.floor(flipbook.hFrames));
  const vFrames = Math.max(1, Math.floor(flipbook.vFrames));
  const frame = cellIndex(z, hFrames * vFrames, flipbook.loop);
  return {
    hFrames,
    vFrames,
    uOffset: (frame % hFrames) / hFrames,
    vOffset: Math.floor((frame + 0.5) / hFrames) / vFrames,
  };
}

/** `frame = floor(z * total)`, then `clamp(frame, 0, total - 1)` without a loop and `mod(frame, total)` with one. */
function cellIndex(z: number, totalFrames: number, loop: boolean): number {
  const frame = Math.floor(z * totalFrames);
  // A non-finite z would poison every UV. The first cell is the one a broken value falls back to.
  if (!Number.isFinite(frame)) return 0;
  if (!loop) return clamp(frame, 0, totalFrames - 1);
  // GLSL `mod` follows the sign of the divisor, so a negative z wraps up.
  return posmod(frame, totalFrames);
}
