/**
 * Position for the crash-fallback placeholder. A Node2D-world type
 * (`nodeComponentRegistry.isCanvasItem`) takes the 2D transform math, since
 * `transformFromNode3DProperties` reads a `.transform` it lacks. A Control keeps
 * the Node3D-shaped origin fallback: it lays out by anchors, not a local transform.
 */

import type { TscnNode } from '../parser/types.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import type { Node3DProperties } from '../nodes/base/node3d/types.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { node2dGroupProps } from './node2dTransform.js';
import { transformFromNode3DProperties, type NodeTransform } from './nodeTransform.js';

export function fallbackTransform(node: TscnNode): NodeTransform {
  if (nodeComponentRegistry.isCanvasItem(node.type)) {
    // Read defensively: a throw inside an ErrorBoundary's fallback blanks the
    // whole viewport, and not every canvas item has a Node2D transform
    // (ParallaxBackground parses `offset` and no `position`).
    const props = node.properties as Partial<Node2DProperties>;
    const { position, rotation, scale } = node2dGroupProps({
      position: props.position ?? { x: 0, y: 0 },
      rotation: props.rotation ?? 0,
      scale: props.scale ?? { x: 1, y: 1 },
      skew: props.skew,
    });
    return { position, rotation, scale };
  }
  return transformFromNode3DProperties(node.properties as Node3DProperties);
}
