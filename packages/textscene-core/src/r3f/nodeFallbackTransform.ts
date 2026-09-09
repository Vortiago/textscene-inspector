/**
 * Position for the crash-fallback placeholder. `transformFromNode3DProperties`
 * reads `properties.transform` — a field only `Node3DProperties` carries, so
 * casting a Node2D-world node's properties to it silently resolves to the
 * origin (Node2DProperties has no `.transform`), placing the fallback box at
 * its parent's local origin instead of near where the crashed node actually
 * was. Route Node2D-world types (`nodeComponentRegistry.isCanvasItem` — the
 * SAME classification `<Node2D>` itself is built on, `node2dGroupProps`)
 * through the matching 2D transform math instead. Control/UI types
 * (`TWO_D_UI_TYPES`) keep the Node3D-shaped fallback: they lay out via
 * anchors/offsets, not position/rotation/scale, so there is no equivalent
 * "local transform" to place a 3D-space placeholder at — same origin
 * fallback `<GenericNodeFallback>` already uses for them today.
 */

import type { TscnNode } from '../parser/types.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import type { Node3DProperties } from '../nodes/base/node3d/types.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { node2dGroupProps } from './node2dTransform.js';
import { transformFromNode3DProperties, type NodeTransform } from './nodeTransform.js';

export function fallbackTransform(node: TscnNode): NodeTransform {
  if (nodeComponentRegistry.isCanvasItem(node.type)) {
    // Read defensively: this runs INSIDE an ErrorBoundary's own fallback, where
    // a throw escapes the boundary and blanks the whole viewport. Not every
    // canvas-item slice publishes the discrete Node2D transform —
    // ParallaxBackground parses `offset` and no `position` at all — so the
    // absent field must fall back rather than deref.
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
