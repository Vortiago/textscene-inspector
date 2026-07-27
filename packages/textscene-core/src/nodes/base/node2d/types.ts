/** Node2D — the base of Godot's 2D (CanvasItem) world hierarchy. */

export interface Vector2 {
  x: number;
  y: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** The decomposed 2D local transform (pixels, radians; Godot +Y-down space). */
export interface Node2DLocalTransform {
  position: Vector2;
  rotation: number;
  scale: Vector2;
  /** Radians; shear tilting the local Y axis relative to X (Godot T·R·Skew·S). */
  skew?: number;
}

export interface Node2DProperties {
  name: string;
  parent?: string;
  instance?: string;
  index?: number;
  visible?: boolean;

  /** Local 2D transform (from `position`/`rotation`/`scale`, or decomposed from `transform`). */
  position: Vector2;
  /** Radians. */
  rotation: number;
  scale: Vector2;
  /** Radians; rarely set, applied as a shear in Godot (deferred — see parser). */
  skew: number;

  /** Draw-order index (CanvasItem.z_index). */
  z_index: number;
  /** When true, z_index is relative to the parent (default true). */
  z_as_relative: boolean;
  /** When true, the node draws behind its parent (CanvasItem, default false). */
  show_behind_parent: boolean;

  /** CanvasItem RGBA tint; multiplies onto this node and all descendants. */
  modulate: Color;
  /** CanvasItem RGBA tint; multiplies onto this node's own pixels only (not inherited). */
  self_modulate: Color;
  /**
   * CanvasItem `light_mask`: which 2D lights may reach this item. A light
   * applies iff `light_mask & light.range_item_cull_mask != 0`, so the Godot
   * default of `1` is what makes an ordinary item take an ordinary light.
   * Per-item and NOT inherited by children.
   */
  light_mask: number;

  /** When true, CanvasItem descendants are sorted by their world-space Y position. */
  y_sort_enabled: boolean;
  /** Y offset applied to sort keys (only meaningful for TileMapLayer tiles). */
  y_sort_origin: number;

  /**
   * CanvasItem `material` — an `ExtResource`/`SubResource` reference to a
   * `CanvasItemMaterial` (or a ShaderMaterial, which is not implemented).
   */
  material?: string;
  /**
   * When true the node draws with its PARENT's material instead of its own,
   * inherited up the chain until a node supplies one (CanvasItem, default false).
   */
  use_parent_material: boolean;
}
