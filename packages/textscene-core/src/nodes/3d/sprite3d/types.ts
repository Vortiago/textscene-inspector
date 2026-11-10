/**
 * Sprite3D types: Godot's Sprite3D, a 2D texture drawn as a quad in 3D space. linterParser.ts holds
 * the authoritative list of recognised properties, and the runtime parser turns each into a typed
 * field.
 */

import type { GeometryInstance3DProperties } from '../geometryinstance3d/types';
import type { MaterialFor2dFields } from '../../../parser/materialFor2dParser';
import type { BillboardMode } from '../../../godot/rendering/materials/billboardMode';
import type { Vector3Axis } from '../../../godot/math/vector3Axis';
import type { Rgba } from '../../../godot/math/math';
import type { Vector2 } from '../../../godot/math/vector';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/**
 * Rect2 (Godot rect resource): a rectangle in 2D space with float coords.
 */
interface Rect2 {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sprite3DProperties extends GeometryInstance3DProperties, MaterialFor2dFields {
  /** Texture resource reference (ExtResource or SubResource). */
  texture?: string;

  /** Billboard mode (default: DISABLED, as for Label3D). */
  billboard: EnumValue<typeof BillboardMode>;

  /** The axis the sprite faces (default: Z, `sprite_3d.h:77`). */
  axis: EnumValue<typeof Vector3Axis>;

  /** Size of one texture pixel in 3D world units (default: 0.01). */
  pixel_size: number;

  /** Number of horizontal frames in the sprite sheet (default: 1). */
  hframes: number;

  /** Number of vertical frames in the sprite sheet (default: 1). */
  vframes: number;

  /** Current frame index (default: 0). */
  frame: number;

  /** Optional explicit (col, row) frame coordinates; overrides `frame` when present. */
  frame_coords?: { x: number; y: number };

  /** Pixel offset from sprite center (default: 0, 0). */
  offset: Vector2;

  /** Quad origin: centred on the node (default true), or at its top-left corner. */
  centered: boolean;

  /** Mirror the texture horizontally / vertically (default false). */
  flip_h: boolean;
  flip_v: boolean;

  /** Use the texture's alpha for transparency (Godot default true). */
  transparent: boolean;

  /** If true, the texture's `region_rect` defines a sub-image to display. */
  region_enabled: boolean;

  /** Sub-region of the texture to display when `region_enabled` is true. */
  region_rect?: Rect2;

  /** Color tint applied to the sprite (default: white). */
  modulate: Rgba;

  /** Render priority within the alpha-blended bucket (default: 0). */
  render_priority: number;
}
