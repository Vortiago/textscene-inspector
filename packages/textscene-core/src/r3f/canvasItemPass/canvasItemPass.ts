/**
 * The canvas item pass (ADR-0060): one walk of the Live scene tree that gives each canvas item its
 * parent item and the state it hands its children, as `RendererCanvasCull::_cull_canvas_item` does
 * in one walk (`renderer_canvas_cull.cpp:303-489`). Pure data of the tree: a Control's solved rect
 * is not in it, so a caller composes that transform.
 */

import type { SceneScope, TscnNode } from '../../parser/types';
import { liveScenePassResults, type LiveScenePass } from '../liveScenePass';
import { liveNodePatches } from '../liveNodePatches';
import { patchedNode } from '../nodePatch';
import { multiplyModulate, WHITE_MODULATE } from '../canvasItemModulate';
import type { Rgba } from '../../godot/math/math';
import {
  inheritTextureSampler,
  ROOT_TEXTURE_SAMPLER,
  type AmbientTextureSampler,
} from '../textureSamplerInheritance';
import { accumulateCanvasItemZ } from '../lighting2d/canvasItemPlacement';
import { canvasItemFieldsOf, type CanvasItemNodeFields } from './canvasItemFields';
import { NOTHING_WRITTEN, writtenChildVisibility } from './writtenVisibility';
import { clipsChildren } from '../canvasPaintOrder';
import { isCanvasLayerType } from '../canvasItemClass';
import { isShownCanvasNode } from '../canvasScopes';

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
  /**
   * The live path of the item whose `clip_children` clips a child, this one or one above it in
   * the chain, or null. A chain start draws outside every owner's group.
   */
  readonly clipOwner: string | null;
}

export interface CanvasItemPassResult {
  /** The live path of the parent canvas item, or null where a chain starts. */
  readonly parent: string | null;
  readonly fields: CanvasItemNodeFields;
  /** The scope the item's material reference resolves in. */
  readonly resources: SceneScope;
  /** The `visible` the item's container writes onto it, or undefined where none writes it. */
  readonly writtenVisible: boolean | undefined;
  /** The item's own `visible`, as its container writes it or the file states it. */
  readonly isVisible: boolean;
  /**
   * The `parent_visible_in_tree` the item sees, from whatever node is above it. It follows the scene
   * tree, `top_level` or not.
   */
  readonly parentVisibleInTree: boolean;
  readonly inherited: InheritedCanvasItemState;
}

/**
 * The material a `use_parent_material` child takes: one an item names, in the scope of the node
 * that names it, or none.
 */
export type CanvasAncestorMaterial = { kind: 'own'; ref: string; resources: SceneScope } | { kind: 'none' };

const NO_PARENT_MATERIAL: CanvasAncestorMaterial = { kind: 'none' };

/** What a chain start inherits: white, z 0, the root sampler, no material and no clip owner. */
export const CHAIN_START: InheritedCanvasItemState = {
  modulate: WHITE_MODULATE,
  zFinal: 0,
  material: NO_PARENT_MATERIAL,
  sampler: ROOT_TEXTURE_SAMPLER,
  clipOwner: null,
};

/** The parent canvas item a child of a visited node links to. */
interface ParentItem {
  readonly path: string;
  readonly inherited: InheritedCanvasItemState;
}

/** What a visited node hands the nodes below it. */
interface Above {
  /** Null where a child starts a chain. */
  readonly item: ParentItem | null;
  /** The `parent_visible_in_tree` a child sees. */
  readonly visibleInTree: boolean;
  /** The `visible` the node writes onto its children, by the child as its group holds it. */
  readonly writes: ReadonlyMap<TscnNode, boolean>;
}

/** The roots sit below the root Window, or below a SubViewport for a viewport's own tree: visible. */
const TREE_TOP: Above = { item: null, visibleInTree: true, writes: NOTHING_WRITTEN };

/**
 * Each canvas item of `tree`, by live path, read through the live property patches, so a pose a
 * RemoteTransform2D pushes is in its fields. A node that is no CanvasItem, a CanvasLayer among
 * them, gets no result, and its children start a chain (`canvas_item.cpp:235-253`).
 */
export const canvasItemPass: LiveScenePass<CanvasItemPassResult> = (tree) => {
  const results = new Map<string, CanvasItemPassResult>();
  const patches = liveScenePassResults(liveNodePatches, tree);
  tree.fold<Above, void>(TREE_TOP, ({ raw, step, path }, above, descend) => {
    const node = patchedNode(step.node, patches.get(path));
    const fields = canvasItemFieldsOf(node);
    const writtenVisible = above.writes.get(raw);
    const isVisible = writtenVisible ?? isShownCanvasNode(node);
    const visibleInTree = visibilityHandedDown(node, fields, isVisible, above.visibleInTree);
    const writes = writtenChildVisibility(tree, step);
    if (!fields) {
      descend({ item: null, visibleInTree, writes });
      return;
    }
    // `get_parent_item` returns null for a `top_level` item (`canvas_item.cpp:565-571`).
    const parent = fields.isTopLevel ? null : above.item;
    const inherited = handedDownState(fields, step.scope, path, parent?.inherited ?? CHAIN_START);
    results.set(path, {
      parent: parent?.path ?? null,
      fields,
      resources: step.scope,
      writtenVisible,
      isVisible,
      parentVisibleInTree: above.visibleInTree,
      inherited,
    });
    descend({ item: { path, inherited }, visibleInTree, writes });
  });
  return results;
};

/**
 * The `parent_visible_in_tree` a node's children take, by the three arms of
 * `NOTIFICATION_ENTER_TREE` (`canvas_item.cpp:311-350`): a CanvasItem gives
 * `visible && parent_visible_in_tree` (`canvas_item.cpp:62-64`), a CanvasLayer
 * its own `is_visible()`, and anything else the root Window's (or a SubViewport's) `true`.
 */
function visibilityHandedDown(
  node: TscnNode,
  fields: CanvasItemNodeFields | null,
  isVisible: boolean,
  parentVisibleInTree: boolean
): boolean {
  if (fields) return parentVisibleInTree && isVisible;
  if (isCanvasLayerType(node.type)) return isVisible;
  return true;
}

/** What the item at `path` with `fields` hands its children down the chain, below one that hands it `above`. */
export function handedDownState(
  fields: CanvasItemNodeFields,
  scope: SceneScope,
  path: string,
  above: InheritedCanvasItemState
): InheritedCanvasItemState {
  return {
    ...linkState(fields, scope, above),
    // `renderer_canvas_cull.cpp:430-434`.
    zFinal: accumulateCanvasItemZ(above.zFinal, fields),
    // A clipping item culls its children inside its own group (`renderer_canvas_cull.cpp:471-484`).
    clipOwner: clipsChildren(fields) ? path : above.clipOwner,
  };
}

/** The state one link hands down apart from z and transform, which each fold keeps its own way. */
type LinkState = Pick<InheritedCanvasItemState, 'modulate' | 'material' | 'sampler'>;

/** What an item with `fields` hands down of `LinkState`, below a link that hands it `above`. */
function linkState(fields: CanvasItemNodeFields, scope: SceneScope, above: LinkState): LinkState {
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
