/** CanvasLayer property definitions — a passthrough layer hosting Control children, not a Control itself. */

export interface CanvasLayerProperties {
  name: string;
  /** Owning node's path, straight off the heading — how the tree is rebuilt. */
  parent?: string;
  /** `instance=` on the heading: a CanvasLayer can be an instanced sub-scene too. */
  instance?: string;
  /** Sibling ordering within the parent, when the scene declares one. */
  index?: number;
  visible?: boolean;
  /** Z-ordering of the layer relative to other CanvasLayers/the default layer. */
  layer?: number;
}
