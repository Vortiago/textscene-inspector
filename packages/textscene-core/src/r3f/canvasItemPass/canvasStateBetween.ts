/** The fold of a skipped chain of canvas items, for an item drawn away from its tree parent. */

import {
  multiplyTransform2D,
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
} from '../../godot/math/transform2d';
import { WHITE_MODULATE } from '../canvasItemModulate';
import { ROOT_TEXTURE_SAMPLER } from '../canvasItemTextureSampler';
import { parentPathOf } from '../../utils/nodePath';
import type { SceneScope, TscnNode } from '../../parser/types';
import { canvasItemFieldsOf } from './canvasItemFields';
import { linkState, type CanvasItemPassResult } from './canvasItemPass';
import {
  INHERIT_PARENT_MATERIAL,
  NO_PARENT_MATERIAL,
  type CanvasAncestorMaterial,
  type CanvasAncestors,
} from './canvasAncestors';

/** What one link of a skipped chain contributes: its own fields, and the scope its material resolves in. */
type CanvasItemLink = Pick<CanvasItemPassResult, 'fields' | 'resources'>;

/** A canvas item of the pass with its live path. */
interface PlacedItem {
  readonly path: string;
  readonly item: CanvasItemPassResult;
}

/**
 * What the canvas items from below `above` down to `itemParent` hand an item, outermost first.
 * `above` null means from the chain start. An `itemParent` that is no canvas item, or is `above`,
 * gives the empty chain.
 *
 * @canonical The CanvasItem state a chain of the live tree hands an item drawn away from it
 */
export function canvasStateBetween(
  results: ReadonlyMap<string, CanvasItemPassResult>,
  above: string | null,
  itemParent: string
): CanvasAncestors {
  const chain = chainBetween(results, above, itemParent);
  return canvasStateAlong(
    chain.map(({ item }) => item),
    startMaterial(chain[0])
  );
}

/**
 * What `chain`, outermost first, hands the item below it. `start` is what a `use_parent_material`
 * outermost link takes. A Control link adds no transform: the caller composes its solved rect.
 */
function canvasStateAlong(chain: readonly CanvasItemLink[], start: CanvasAncestorMaterial): CanvasAncestors {
  return chain.reduce(foldLink, {
    transform: TRANSFORM2D_IDENTITY,
    modulate: WHITE_MODULATE,
    z: [],
    sampler: ROOT_TEXTURE_SAMPLER,
    material: start,
  });
}

/**
 * What a chain of drawn nodes, outermost first, hands the item below it, each material resolving in
 * `scope`, and the outermost deferring to the item above the chain. It reads the nodes, not the
 * canvas item pass: a scene tile's instance draws nodes the live tree does not hold. A node that is
 * no canvas item adds nothing.
 *
 * @canonical The CanvasItem state a chain of drawn nodes hands the item below it
 */
export function canvasStateOfDrawn(chain: readonly TscnNode[], scope: SceneScope): CanvasAncestors {
  const links = chain.flatMap((node) => {
    const fields = canvasItemFieldsOf(node);
    return fields ? [{ fields, resources: scope }] : [];
  });
  return canvasStateAlong(links, INHERIT_PARENT_MATERIAL);
}

/** The items from `itemParent` up to below `above` or to a chain start, whichever comes first, outermost first. */
function chainBetween(
  results: ReadonlyMap<string, CanvasItemPassResult>,
  above: string | null,
  itemParent: string
): PlacedItem[] {
  const innermostFirst: PlacedItem[] = [];
  let path: string | null = itemParent;
  while (path !== null && path !== above) {
    const item = results.get(path);
    if (!item) break;
    innermostFirst.push({ path, item });
    path = item.parent;
  }
  return innermostFirst.reverse();
}

/**
 * What a `use_parent_material` outermost item takes. A chain that reaches `above` defers to it, and
 * so does one that starts at a root of the tree, under whatever draws the tree. A chain that starts
 * below a node that is no canvas item, or at a `top_level` item, has no parent item to defer to.
 */
function startMaterial(outermost: PlacedItem | undefined): CanvasAncestorMaterial {
  if (!outermost || outermost.item.parent !== null) return INHERIT_PARENT_MATERIAL;
  const startsAtTreeRoot = parentPathOf(outermost.path) === null && !outermost.item.fields.isTopLevel;
  return startsAtTreeRoot ? INHERIT_PARENT_MATERIAL : NO_PARENT_MATERIAL;
}

/** `chain` with one more link below it. */
function foldLink(chain: CanvasAncestors, { fields, resources }: CanvasItemLink): CanvasAncestors {
  return {
    ...linkState(fields, resources, chain),
    // The link's local transform first, then the chain above it, as `get_global_transform()` composes.
    transform: composedTransform(chain.transform, fields.local),
    // Appended, not summed: `p_z` clamps at every step and a `z_relative == false` item
    // restarts (`renderer_canvas_cull.cpp:430-434`), so only the ambient z can fold it.
    z: [...chain.z, { zIndex: fields.zIndex, zAsRelative: fields.zAsRelative }],
  };
}

function composedTransform(above: Transform2DColumns, local: Transform2DColumns | null): Transform2DColumns {
  return local ? multiplyTransform2D(above, local) : above;
}
