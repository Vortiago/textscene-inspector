/**
 * A light's place in its canvas light list, its draw order: Godot applies lights in attach order
 * (`renderer_canvas_cull.cpp:2102`, `renderer_viewport.cpp:450-473`), the preorder walk, and MIX
 * depends on the order. The stencil ordinal cannot serve, as it follows
 * cookie load order and is reused on unmount. The walk reads the live tree, since
 * `YSortDispatcher` mounts in sort order and Godot ranks by tree position.
 */

import type { TscnNode } from '../../parser/types.js';
import { keepsChildrenInViewport } from '../../nodes/viewport/subviewport/viewportBoundary.js';

/**
 * Canvas lights that take a slot in the positional list. A `DirectionalLight2D` sits on a list of
 * its own (`renderer_viewport.cpp:491-514`), applied ahead of every positional light.
 */
const POSITIONAL_LIGHT_TYPES = new Set(['PointLight2D']);

/** True for a node that occupies a slot in the positional canvas light list. */
export function isPositionalCanvasLight(node: TscnNode): boolean {
  return POSITIONAL_LIGHT_TYPES.has(node.type);
}

/** Whether a node is shown, reading the parsed `visible` a CanvasItem parser leaves unset by default. */
function isShownCanvasNode(node: TscnNode): boolean {
  return (node.properties as { visible?: boolean }).visible !== false;
}

/**
 * Whether the directional walk enters a node's children. A SubViewport's children live in its own
 * World2D (`viewport.cpp:5345`), and a hidden node's lights are disabled.
 */
export function holdsListedDirectionalLights(node: TscnNode): boolean {
  return keepsChildrenInViewport(node) && isShownCanvasNode(node);
}

/**
 * True for a DirectionalLight2D that reaches the directional list. `Light2D::_update_light_visibility`
 * (`light_2d.cpp:59`) enables the light only while it is `enabled` and visible in the tree, and the
 * viewport lists only enabled lights, so a disabled or hidden light takes no slot.
 */
export function isListedDirectionalLight(node: TscnNode): boolean {
  return (
    node.type === 'DirectionalLight2D' &&
    (node.properties as { enabled?: boolean }).enabled !== false &&
    isShownCanvasNode(node)
  );
}

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
