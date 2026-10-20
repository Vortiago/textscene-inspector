/** The Sprite2D property shape: a textured quad in 2D space, on Node2D. */

import type { Node2DProperties } from '../../base/node2d/types';
import type { Vector2 } from '../../../godot/math/vector';

interface Rect2 {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sprite2DProperties extends Node2DProperties {
  /** `ExtResource("id")` or `res://…` reference; undefined → placeholder. */
  texture?: string;
  /** Quad centred on the node origin (default true), else its top-left sits there. */
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
}
