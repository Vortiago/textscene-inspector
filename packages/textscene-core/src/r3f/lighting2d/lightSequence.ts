/**
 * A light's position in the canvas's light list — its DRAW order.
 *
 * Godot hands a canvas's lights to the renderer in ATTACH order, which for a
 * scene loaded from disk is the preorder walk of the tree, and applies them in
 * that order per lit item. `light_blend_compute`'s MIX is order-dependent
 *
 *   MIX: color.rgb = mix(color.rgb, light_color.rgb, light_color.a)
 *
 * so the sequence is part of the result, not just bookkeeping. ADD and SUB
 * commute, which is why this went unnoticed while the corpus used only those.
 *
 * WHY NOT THE REGISTRATION ORDINAL. The ordinal exists to keep the shadow
 * STENCIL stamps of one pass apart, and `freeOrdinal` deliberately reuses the
 * lowest free slot to keep them dense in an 8-bit buffer. Both properties are
 * wrong for draw order: a light registers when its cookie RESOLVES (an inline
 * GradientTexture2D in the same tick, a `res://` PNG several later), so the
 * initial order is resource-arrival order; and slot reuse means unmounting one
 * light renumbers a later one, changing the composited colour of an overlap on
 * a mount/unmount cycle. The two jobs are now split — ordinal for the stencil
 * ref, sequence for render order.
 *
 * WHY THE LIVE TREE and not the mounted THREE graph: `YSortDispatcher` mounts
 * its items in SORT order, so ranking the mounted anchors would order a light
 * under a y-sorted subtree by its y-sort position. Godot ranks it by tree
 * position regardless of z or y-sort. The live tree is also what composes
 * instanced sub-scenes into one path space (ADR-0013), so a light inside an
 * instance is numbered where the instance sits.
 */

import type { TscnNode } from '../../parser/types.js';

/**
 * Canvas lights that take a slot in the light list. `DirectionalLight2D` is a
 * Light2D but not a positional one — it has no cookie quad in this pass, so it
 * takes no slot and must not consume a sequence number.
 */
const POSITIONAL_LIGHT_TYPES = new Set(['PointLight2D']);

/** True for a node that occupies a slot in the canvas light list. */
export function isPositionalCanvasLight(node: TscnNode): boolean {
  return POSITIONAL_LIGHT_TYPES.has(node.type);
}

/**
 * `path -> sequence` for every positional light in preorder, numbered densely
 * from zero. Pure: the caller supplies the tree, so the live-tree walk and its
 * loader plumbing stay in the hook.
 */
export function lightSequenceByPath(roots: readonly TscnNode[]): Map<string, number> {
  const out = new Map<string, number>();
  let seq = 0;

  const walk = (nodes: readonly TscnNode[], parentPath: string): void => {
    for (const node of nodes) {
      const path = parentPath ? `${parentPath}/${node.name}` : node.name;
      if (isPositionalCanvasLight(node)) out.set(path, seq++);
      walk(node.children, path);
    }
  };

  walk(roots, '');
  return out;
}
