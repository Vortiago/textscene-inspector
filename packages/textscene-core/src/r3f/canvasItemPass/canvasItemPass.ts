/**
 * The canvas item pass (ADR-0060): one walk of the Live scene tree that gives each canvas item its
 * parent item and the state it hands its children, as `RendererCanvasCull::_cull_canvas_item` does
 * in one walk (`renderer_canvas_cull.cpp:303-489`). Pure data of the tree: a Control's solved rect
 * is not in it, so a caller composes that transform.
 */

import type { SceneScope } from '../../parser/types';
import { liveScenePassResults, type LiveScenePass } from '../liveScenePass';
import { liveNodePatches } from '../liveNodePatches';
import { patchedNode } from '../nodePatch';
import { multiplyModulate, WHITE_MODULATE } from '../canvasItemModulate';
import type { Rgba } from '../../godot/math/math';
import {
  inheritTextureSampler,
  ROOT_TEXTURE_SAMPLER,
  type AmbientTextureSampler,
} from '../canvasItemTextureSampler';
import { accumulateCanvasItemZ } from '../lighting2d/canvasItemPlacement';
import { canvasItemFieldsOf, type CanvasItemNodeFields } from './canvasItemFields';
import { NO_PARENT_MATERIAL, type CanvasAncestorMaterial } from './canvasAncestors';

/** What a canvas item hands its children. */
export interface InheritedCanvasItemState {
  /** The product of every `modulate` from the chain start, own included. `self_modulate` is not in it. */
  readonly modulate: Rgba;
  /** `z_final` after each clamped step from the chain start, own included. */
  readonly zFinal: number;
  /** The material in force for a `use_parent_material` child of this item. */
  readonly material: CanvasAncestorMaterial;
  /** The filter and repeat a child inherits. */
  readonly sampler: AmbientTextureSampler;
}

export interface CanvasItemPassResult {
  /** The live path of the parent canvas item, or null where a chain starts. */
  readonly parent: string | null;
  readonly fields: CanvasItemNodeFields;
  /** The scope the item's material reference resolves in. */
  readonly resources: SceneScope;
  readonly inherited: InheritedCanvasItemState;
}

/** What a chain start inherits: white, z 0, the root sampler and no material. */
const CHAIN_START: InheritedCanvasItemState = {
  modulate: WHITE_MODULATE,
  zFinal: 0,
  material: NO_PARENT_MATERIAL,
  sampler: ROOT_TEXTURE_SAMPLER,
};

/** The parent canvas item a child of a visited node links to, null where the child starts a chain. */
interface ParentItem {
  readonly path: string;
  readonly inherited: InheritedCanvasItemState;
}

/**
 * Each canvas item of `tree`, by live path, read through the live property patches, so a pose a
 * RemoteTransform2D pushes is in its fields. A node that is no CanvasItem, a CanvasLayer among
 * them, gets no result, and its children start a chain (`canvas_item.cpp:235-253`).
 */
export const canvasItemPass: LiveScenePass<CanvasItemPassResult> = (tree) => {
  const results = new Map<string, CanvasItemPassResult>();
  const patches = liveScenePassResults(liveNodePatches, tree);
  tree.fold<ParentItem | null, void>(null, ({ step, path }, above, descend) => {
    const fields = canvasItemFieldsOf(patchedNode(step.node, patches.get(path)));
    if (!fields) {
      descend(null);
      return;
    }
    // `get_parent_item` returns null for a `top_level` item (`canvas_item.cpp:565-571`).
    const parent = fields.isTopLevel ? null : above;
    const inherited = inheritedState(fields, step.scope, parent?.inherited ?? CHAIN_START);
    results.set(path, {
      parent: parent?.path ?? null,
      fields,
      resources: step.scope,
      inherited,
    });
    descend({ path, inherited });
  });
  return results;
};

/** What an item with `fields` hands its children, below an item that hands it `above`. */
function inheritedState(
  fields: CanvasItemNodeFields,
  scope: SceneScope,
  above: InheritedCanvasItemState
): InheritedCanvasItemState {
  return {
    ...linkState(fields, scope, above),
    // `renderer_canvas_cull.cpp:430-434`.
    zFinal: accumulateCanvasItemZ(above.zFinal, fields),
  };
}

/** The state one link hands down apart from z and transform, which each fold keeps its own way. */
export type LinkState = Pick<InheritedCanvasItemState, 'modulate' | 'material' | 'sampler'>;

/** What an item with `fields` hands down of `LinkState`, below a link that hands it `above`. */
export function linkState(fields: CanvasItemNodeFields, scope: SceneScope, above: LinkState): LinkState {
  return {
    // `renderer_canvas_cull.cpp:326`. `self_modulate` stays on the item's own pixels (`:268`).
    modulate: multiplyModulate(above.modulate, fields.modulate),
    material: materialFor(fields, scope, above.material),
    // Own over above, each property on its own: a PARENT_NODE link takes its parent's.
    sampler: inheritTextureSampler(
      { filter: fields.textureFilter, repeat: fields.textureRepeat },
      above.sampler
    ),
  };
}

/**
 * The material a `use_parent_material` child takes: the item's own, or with `use_parent_material`
 * the one above it (`renderer_canvas_cull.cpp:319-323`).
 */
function materialFor(
  fields: CanvasItemNodeFields,
  scope: SceneScope,
  above: CanvasAncestorMaterial
): CanvasAncestorMaterial {
  if (fields.usesParentMaterial) return above;
  return fields.materialRef ? { kind: 'own', ref: fields.materialRef, resources: scope } : NO_PARENT_MATERIAL;
}
