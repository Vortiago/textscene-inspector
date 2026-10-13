/**
 * Fits an omni, spot or area light's shadow to the slot Godot's positional shadow atlas gives the
 * light: where it draws, its normal bias and its PCF kernel.
 */

import type { PositionalShadowSlot } from '../../godot/positionalShadowAtlas.js';
import { positionalShadowNormalBias } from '../../godot/positionalShadow.js';
import type { AtlasLight } from './adoptAtlasShadow.js';
import type { PositionalShadowDeclaration } from './declaration.js';

/**
 * A null slot draws no shadow (`slotOpacity.ts`), and nothing draws into the light's map, which
 * the light keeps.
 */
export function fitPositionalShadow(
  light: AtlasLight,
  slot: PositionalShadowSlot | null,
  declaration: PositionalShadowDeclaration
): void {
  const { shadow } = light;
  shadow.place(slot);
  if (slot === null) return;
  shadow.normalBias = positionalShadowNormalBias(declaration.normalBias, slot.size);
  // Each lookup spreads it in its own units (`positionalShadowLookup.ts`).
  shadow.radius = declaration.softShadowRadius;
  // three builds the projection only with a map it builds itself, or when the far plane moves
  // (`WebGLShadowMap.js:277`, `:304-309`), and the atlas gives every shadow its map.
  shadow.camera.updateProjectionMatrix();
}
