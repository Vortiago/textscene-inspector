/**
 * The fold of an ancestor chain into the CanvasItem state of an item drawn away from its tree
 * parent: the y-sort lift and the Control walker each draw an item without the groups of the
 * canvas items above it, so each puts back what those items hand down. Pure data: no React.
 * Visibility stays out: an animation and the editor's eye toggle change it per node at runtime.
 */

import type { SceneScope, TscnNode } from '../parser/types';
import type { Node2DProperties } from '../nodes/base/node2d/types';
import {
  multiplyTransform2D,
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
} from '../godot/math/transform2d';
import { multiplyModulate, WHITE_MODULATE } from './canvasItemModulate';
import {
  inheritTextureSampler,
  ROOT_TEXTURE_SAMPLER,
  type AmbientTextureSampler,
} from './canvasItemTextureSampler';
import { node2DLocalTransform } from './node2dTransform';
import type { SkippedCanvasItems } from './canvasItemState';

/**
 * The material of the chain's innermost item, which a `use_parent_material` item below takes: one
 * the chain names, in the scope of the node that names it, none, or the item above the chain's.
 */
export type CanvasAncestorMaterial =
  { kind: 'own'; ref: string; resources: SceneScope } | { kind: 'inherit' } | { kind: 'none' };

/** A chain that defers to the item above it, such as the sort root of a y-sort lift. */
export const INHERIT_PARENT_MATERIAL: CanvasAncestorMaterial = { kind: 'inherit' };
/** A chain that defers to nothing, since its outermost link has no parent item. */
export const NO_PARENT_MATERIAL: CanvasAncestorMaterial = { kind: 'none' };

export interface CanvasAncestors extends SkippedCanvasItems {
  /**
   * Composed `Transform2D`, outermost first (`transform_2d.cpp:198-218`). Never decomposed:
   * composed ancestors can shear, which rotation and scale cannot represent.
   */
  transform: Transform2DColumns;
  /**
   * The `texture_filter` and `texture_repeat` the chain names, the innermost winning
   * (`canvas_item.cpp:1625-1699`). Unnamed where none does, so the ambient above the chain decides.
   */
  sampler: AmbientTextureSampler;
  material: CanvasAncestorMaterial;
}

/**
 * The state `chain` hands the item below it, outermost first, each link's material resolving in
 * `scope`. `start` is what the chain defers to where every link takes its parent's material.
 *
 * @canonical The CanvasItem state an ancestor chain hands an item drawn away from it
 */
export function foldCanvasAncestors(
  chain: readonly TscnNode[],
  scope: SceneScope,
  start: CanvasAncestorMaterial
): CanvasAncestors {
  return chain.reduce((above, link) => foldCanvasAncestor(above, link, scope), emptyChain(start));
}

/** `above` with one more link below it, whose material resolves in `scope`. */
export function foldCanvasAncestor(
  above: CanvasAncestors,
  link: TscnNode,
  scope: SceneScope
): CanvasAncestors {
  const props = link.properties as Partial<Node2DProperties>;
  return {
    // The link's local transform first, then the chain above it, as `get_global_transform()` composes.
    transform: multiplyTransform2D(above.transform, node2DLocalTransform(props)),
    // `_cull_canvas_item` folds each item's `modulate` into what its children inherit
    // (`renderer_canvas_cull.cpp:326`). `self_modulate` stays on the item's own pixels.
    modulate: multiplyModulate(above.modulate, props.modulate ?? WHITE_MODULATE),
    // Appended, not summed: `p_z` clamps at every step and a `z_relative == false` item
    // restarts (`renderer_canvas_cull.cpp:430-434`), so only the ambient z can fold it.
    z: [...above.z, { zIndex: props.z_index ?? 0, zAsRelative: props.z_as_relative !== false }],
    // Own over above, each property on its own: a PARENT_NODE link takes its parent's.
    sampler: inheritTextureSampler(
      { filter: props.texture_filter, repeat: props.texture_repeat },
      above.sampler
    ),
    material: linkMaterial(props, scope, above.material),
  };
}

function emptyChain(start: CanvasAncestorMaterial): CanvasAncestors {
  return {
    transform: TRANSFORM2D_IDENTITY,
    modulate: WHITE_MODULATE,
    z: [],
    sampler: ROOT_TEXTURE_SAMPLER,
    material: start,
  };
}

/** A link's own `material`, or with `use_parent_material` the one above it (`renderer_canvas_cull.cpp:319-323`). */
function linkMaterial(
  props: Partial<Node2DProperties>,
  scope: SceneScope,
  above: CanvasAncestorMaterial
): CanvasAncestorMaterial {
  if (props.use_parent_material) return above;
  return props.materialPath ? { kind: 'own', ref: props.materialPath, resources: scope } : NO_PARENT_MATERIAL;
}
