/**
 * Fits an omni or spot light's shadow to the slot Godot's positional shadow atlas gives the light:
 * where it draws, its normal bias and its PCF kernel.
 */

import type { PositionalShadowSlot } from '../../godot/positionalShadowAtlas.js';
import { positionalShadowNormalBias } from '../../godot/positionalShadow.js';
import type { AtlasLight } from './adoptAtlasShadow.js';
import type { PositionalShadowDeclaration } from './declaration.js';

/** three's own shadow intensity, which a light with a slot keeps. */
const FULL_SHADOW = 1;

/**
 * A null slot draws no shadow: Godot sends an opacity of zero for a light the atlas holds no slot
 * for (`light_storage.cpp:947-1029`), and draws nothing for it. The light keeps its map.
 */
export function fitPositionalShadow(
  light: AtlasLight,
  slot: PositionalShadowSlot | null,
  declaration: PositionalShadowDeclaration
): void {
  const { shadow } = light;
  shadow.intensity = slot === null ? 0 : FULL_SHADOW;
  shadow.autoUpdate = slot !== null;
  shadow.place(slot);
  if (slot === null) return;
  shadow.normalBias = positionalShadowNormalBias(declaration.normalBias, slot.size);
  // Godot's `soft_shadow_scale`, which both lookups spread in their own units (`positionalShadowLookup.ts`).
  shadow.radius = declaration.softShadowScale;
  // three builds the projection only with a map it builds itself, or when the far plane moves
  // (`WebGLShadowMap.js:277`, `:304-309`), and the atlas gives every shadow its map.
  shadow.camera.updateProjectionMatrix();
}
