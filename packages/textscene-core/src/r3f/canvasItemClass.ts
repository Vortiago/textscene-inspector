/**
 * Which canvas class a node is, from ClassDB. A leaf module, so the canvas item fields and the
 * paint order both read it without importing each other.
 */

import type { TscnNode } from '../parser/types';
import { descendsFromClass } from '../godot/classdb/classBaseTypes';

/**
 * Whether this type starts a canvas of its own: `_enter_canvas` climbs to
 * `Object::cast_to<CanvasLayer>(n)` (`canvas_item.cpp:246-252`). Derived from
 * ClassDB, so a subclass such as `ParallaxBackground` (`parallax_background.h:34`)
 * counts. `controls/canvasBoundary.driftguard.test.ts` holds the Control walk to it.
 */
export function isCanvasLayerType(type: string): boolean {
  return descendsFromClass(type, 'CanvasLayer');
}

/** Filled by `isControlType` and never cleared: a class's chain is fixed. */
const controlTypes = new Map<string, boolean>();

/** Cached, since every allocation sizes each subtree again and the chain walk is per call. */
export function isControlType(type: string): boolean {
  let isControl = controlTypes.get(type);
  if (isControl === undefined) {
    isControl = descendsFromClass(type, 'Control');
    controlTypes.set(type, isControl);
  }
  return isControl;
}

/**
 * Whether `Object::cast_to<CanvasItem>` accepts this node. `get_parent_item()`
 * applies it to the direct parent (`canvas_item.cpp:565-571`) to decide whether
 * an item nests under it or parents at the canvas.
 */
export function isCanvasItem(node: TscnNode): boolean {
  return descendsFromClass(node.type, 'CanvasItem');
}
