/**
 * The camera layer the 2D light pass draws on, and the draw order inside a pass. Godot applies the
 * directional lights before the positional ones (`canvas.glsl:727` loops before `:768`), so their
 * render orders sit below every positional light's.
 */

import { MAX_2D_DIRECTIONAL_LIGHTS } from '../../godot/rendering.js';

/**
 * Every light-pass mesh draws on this layer alone: the seed, the light quads and the shadow
 * volumes. The main pass never renders it. Each accumulation pass renders it with the meshes of
 * lights off its list hidden.
 */
export const LIGHT_PASS_LAYER = 1;

/** The seed lands under every light. */
export const SEED_RENDER_ORDER = -MAX_2D_DIRECTIONAL_LIGHTS - 1;

/** A directional light's draw order from its slot in the directional list, below every positional light. */
export function directionalRenderOrder(slot: number): number {
  return slot - MAX_2D_DIRECTIONAL_LIGHTS;
}
