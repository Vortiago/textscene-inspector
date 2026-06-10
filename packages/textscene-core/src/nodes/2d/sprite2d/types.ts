/** Sprite2D — a textured quad in 2D space (extends Node2D). */

import type { Node2DProperties, Vector2 } from '../../base/node2d/types';

export interface Rect2 {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sprite2DProperties extends Node2DProperties {
  /** `ExtResource("id")` or `res://…` reference; undefined → placeholder. */
  texture?: string;
  /** Quad centered on the node origin (default true) vs. top-left at origin. */
  centered: boolean;
  /** Pixel offset of the quad (Godot 2D, +Y down). */
  offset: Vector2;
  flip_h: boolean;
  flip_v: boolean;
  region_enabled: boolean;
  region_rect?: Rect2;
  hframes: number;
  vframes: number;
  frame: number;
  frame_coords?: Vector2;
  // `modulate` (CanvasItem RGBA tint) is inherited from Node2DProperties.
}
