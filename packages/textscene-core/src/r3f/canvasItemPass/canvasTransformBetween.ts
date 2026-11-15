/** The transform of a skipped chain of canvas items, for an item drawn away from its tree parent. */

import {
  multiplyTransform2D,
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
} from '../../godot/math/transform2d';
import type { CanvasItemNodeFields } from './canvasItemFields';
import type { CanvasItemPassResult } from './canvasItemPass';

/**
 * The composed transform of the canvas items from below `above` down to `itemParent`, outermost
 * first. `above` null means from the chain start. An `itemParent` that is no canvas item, or is
 * `above`, gives the identity.
 *
 * @canonical The transform a chain of the live tree hands an item drawn away from it
 */
export function canvasTransformBetween(
  results: ReadonlyMap<string, CanvasItemPassResult>,
  above: string | null,
  itemParent: string
): Transform2DColumns {
  return transformAlong(chainBetween(results, above, itemParent));
}

/**
 * The link's local transform first, then the chain above it, as `get_global_transform()` composes.
 * A Control link adds no transform: the caller composes its solved rect.
 */
function transformAlong(chain: readonly CanvasItemNodeFields[]): Transform2DColumns {
  return chain.reduce(
    (above, { local }) => (local ? multiplyTransform2D(above, local) : above),
    TRANSFORM2D_IDENTITY
  );
}

/** The fields of the items from `itemParent` up to below `above` or to a chain start, outermost first. */
function chainBetween(
  results: ReadonlyMap<string, CanvasItemPassResult>,
  above: string | null,
  itemParent: string
): CanvasItemNodeFields[] {
  const innermostFirst: CanvasItemNodeFields[] = [];
  let path: string | null = itemParent;
  while (path !== null && path !== above) {
    const item = results.get(path);
    if (!item) break;
    innermostFirst.push(item.fields);
    path = item.parent;
  }
  return innermostFirst.reverse();
}
