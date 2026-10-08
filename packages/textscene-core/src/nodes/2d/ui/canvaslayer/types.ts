/** CanvasLayer properties: a passthrough layer hosting Control children, not a Control itself. */

import type { Transform2DColumns } from '../../../../godot/transform2d.js';

export interface CanvasLayerProperties {
  name: string;
  /** Owning node's path, straight off the heading: how the tree is rebuilt. */
  parent?: string;
  /** `instance=` on the heading: a CanvasLayer can be an instanced sub-scene too. */
  instance?: string;
  /** Sibling ordering within the parent, when the scene declares one. */
  index?: number;
  visible?: boolean;
  /** Z-ordering of the layer relative to other CanvasLayers/the default layer. */
  layer?: number;
  /**
   * Godot's `transform`: the layer's canvas transform, which every item on its canvas draws
   * through. Renamed, since a Node3D's `transform` is a 3D one.
   */
  canvasTransform: Transform2DColumns;
  /** Whether the layer draws through the viewport's canvas transform, a Camera2D's, too. */
  follow_viewport_enabled: boolean;
  /** The scale a following layer takes about the viewport's centre. */
  follow_viewport_scale: number;
}
