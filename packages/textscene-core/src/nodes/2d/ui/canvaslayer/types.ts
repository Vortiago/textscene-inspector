/** CanvasLayer property definitions — a passthrough layer hosting Control children, not a Control itself. */

export interface CanvasLayerProperties {
  name: string;
  visible?: boolean;
  /** Z-ordering of the layer relative to other CanvasLayers/the default layer. */
  layer?: number;
}
