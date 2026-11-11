/**
 * The `Transform2D` of a Node2D of the Live scene tree, composed from the transforms of the nodes
 * on the way down to it, so it holds across an instance border. A node that is no Node2D adds the
 * identity.
 */

import type { TscnNode } from '../parser/types.js';
import {
  TRANSFORM2D_IDENTITY,
  multiplyTransform2D,
  type Transform2DColumns,
} from '../godot/math/transform2d.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import { node2DLocalTransform } from './node2dTransform.js';

/** The local transform of `node`, the identity for a node with no Node2D position. */
export function localTransform2D(node: TscnNode): Transform2DColumns {
  const props = node.properties as Partial<Node2DProperties>;
  if (!props || props.position === undefined) return TRANSFORM2D_IDENTITY;
  return node2DLocalTransform(props);
}

/**
 * The transform of the node at `path` within the node at `ancestorPath`, or within the canvas for a
 * null ancestor. `nodeByPath` holds the node at each prefix of `path`, as `nodesOnTheWayTo` makes it.
 */
export function transform2DBelow(
  path: string,
  ancestorPath: string | null,
  nodeByPath: ReadonlyMap<string, TscnNode>
): Transform2DColumns {
  let result = TRANSFORM2D_IDENTITY;
  let prefix = '';
  for (const segment of path.split('/')) {
    prefix = prefix ? `${prefix}/${segment}` : segment;
    const isAtOrAboveAncestor =
      ancestorPath !== null && (ancestorPath === prefix || ancestorPath.startsWith(`${prefix}/`));
    const node = nodeByPath.get(prefix);
    if (!isAtOrAboveAncestor && node) result = multiplyTransform2D(result, localTransform2D(node));
  }
  return result;
}
