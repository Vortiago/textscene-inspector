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
 * The transform of the node at `path` on the canvas. `nodeByPath` holds the node at each prefix of
 * `path`, as `nodesOnTheWayTo` makes it.
 */
export function transform2DOnCanvas(
  path: string,
  nodeByPath: ReadonlyMap<string, TscnNode>
): Transform2DColumns {
  return composedBelow(path, 0, nodeByPath);
}

/** The transform of the node at `path` within its ancestor at `ancestorPath`. */
export function transform2DWithin(
  path: string,
  ancestorPath: string,
  nodeByPath: ReadonlyMap<string, TscnNode>
): Transform2DColumns {
  return composedBelow(path, ancestorPath.split('/').length, nodeByPath);
}

/** The local transforms of the nodes of `path` from the segment `skipped` down, composed. */
function composedBelow(
  path: string,
  skipped: number,
  nodeByPath: ReadonlyMap<string, TscnNode>
): Transform2DColumns {
  let result = TRANSFORM2D_IDENTITY;
  let prefix = '';
  path.split('/').forEach((segment, depth) => {
    prefix = prefix ? `${prefix}/${segment}` : segment;
    const node = nodeByPath.get(prefix);
    if (depth >= skipped && node) result = multiplyTransform2D(result, localTransform2D(node));
  });
  return result;
}
