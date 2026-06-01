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

  /** CanvasItem RGBA tint; multiplies onto this node and all descendants. */
  modulate: Color;
}
