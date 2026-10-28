/**
 * A light's place in its canvas light list, its draw order: Godot applies lights in attach order
 * (`renderer_canvas_cull.cpp:2102`, `renderer_viewport.cpp:450-473`), the preorder walk of
 * `canvasScopes.ts`, and MIX depends on the order. The stencil ordinal cannot serve, as it follows
 * cookie load order and is reused on unmount. The walk reads the live tree, since
 * `YSortDispatcher` mounts in sort order and Godot ranks by tree position.
 */

/**
 * Where an unlisted light ranks: after every listed light, so the cap and the draw agree when
 * listed and unlisted lights mix. A canvas holds far fewer than 2^20 lights.
 */
const UNLISTED_LIGHT_SEQUENCE = 2 ** 20;

/**
 * The sequence a light draws at: its `listed` place, else after every listed light by `ordinal`. A
 * light declares before it has an ordinal, so unlisted lights tie there, and the cap breaks the tie
 * by ordinal, which is the order the draw uses.
 */
export function lightDrawSequence(listed: number | null, ordinal: number | null): number {
  return listed ?? UNLISTED_LIGHT_SEQUENCE + (ordinal ?? 0);
}
