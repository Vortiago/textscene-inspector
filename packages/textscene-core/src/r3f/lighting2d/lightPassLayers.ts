/**
 * The camera layer the 2D light pass draws on, and the draw order inside a pass. Godot applies the
 * directional lights before the positional ones (`canvas.glsl:727` loops before `:768`), so their
 * render orders sit below every positional light's.
 */

/**
 * Every light-pass mesh draws on this layer alone: the seed, the light quads and the shadow
 * volumes. The main pass never renders it. Each accumulation pass renders it with the meshes of
 * lights off its list hidden.
 */
export const LIGHT_PASS_LAYER = 1;

/**
 * The directional draw orders sit in a band of this width below the positional ones. A viewport
 * lists no fixed number of directional lights: a CanvasLayer lists its lights past the cap
 * (`canvasScopes.ts`), and a canvas holds far fewer than 2^20 lights.
 */
const DIRECTIONAL_BAND = 2 ** 20;

/** The seed lands under every light. */
export const SEED_RENDER_ORDER = -DIRECTIONAL_BAND - 1;

/** A directional light's draw order from its slot in the directional list, below every positional light. */
export function directionalRenderOrder(slot: number): number {
  return slot - DIRECTIONAL_BAND;
}
