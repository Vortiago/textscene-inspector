/**
 * Sprite3D types and interfaces.
 *
 * Mirrors Godot's Sprite3D — a 2D texture rendered as a billboarded quad
 * in 3D space. The property surface here matches the linter's strict
 * validators in linterParser.ts (the authoritative list of recognised
 * properties); the runtime parser converts each one into a typed field.
 */

import type { Node3DProperties } from '../../base/node3d/types';
import type { Color } from '../../../utils/colorParser';
import type { Vector2 } from '../../../parser/vectors';

/**
 * Billboard modes for Sprite3D. Same enum as Label3D (both inherit from
 * BaseMaterial3D.BillboardMode in Godot).
 */
export enum BillboardMode {
  /** Billboard disabled — sprite uses its own orientation. */
  BILLBOARD_DISABLED = 0,
  /** Billboard enabled — sprite always faces the camera. */
  BILLBOARD_ENABLED = 1,
  /** Billboard Y-axis only — sprite rotates around Y to face the camera. */
  BILLBOARD_FIXED_Y = 2,
  /** Particles billboard mode (not supported in Sprite3D itself). */
  BILLBOARD_PARTICLES = 3,
}

/**
 * Alpha-cut modes. Controls how transparent regions of the texture are
 * handled with respect to depth writes.
 */
export enum AlphaCutMode {
  /** No alpha cut — material uses regular transparency. */
  ALPHA_CUT_DISABLED = 0,
  /** Discard fragments below alpha threshold; opaque pixels write depth. */
  ALPHA_CUT_DISCARD = 1,
  /** Opaque prepass for sharp-edge-with-shadow scenarios. */
  ALPHA_CUT_OPAQUE_PREPASS = 2,
}

/**
 * Axis enum used when `billboard === BILLBOARD_FIXED_Y` to declare which
 * axis the sprite locks to.
 */
export enum AxisMode {
  AXIS_X = 0,
  AXIS_Y = 1,
  AXIS_Z = 2,
}

/**
 * Rect2 (Godot rect resource): a rectangle in 2D space with float coords.
 */
export interface Rect2 {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sprite3DProperties extends Node3DProperties {
  /** Texture resource reference (ExtResource or SubResource). */
  texture?: string;

  /** Billboard mode (default: DISABLED — Godot's Sprite3D default differs from Label3D). */
  billboard: BillboardMode;

  /** Alpha-cut mode (default: DISABLED). */
  alpha_cut: AlphaCutMode;

  /** Axis used when billboard is FIXED_Y (default: Y_AXIS). */
  axis: AxisMode;

  /** Size of one texture pixel in 3D world units (default: 0.01). */
  pixel_size: number;

  /** Transparency override (0 = opaque, 1 = fully transparent). Default: 0. */
  transparency: number;

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

  /** If true, the texture's `region_rect` defines a sub-image to display. */
  region_enabled: boolean;

  /** Sub-region of the texture to display when `region_enabled` is true. */
  region_rect?: Rect2;

  /** Color tint applied to the sprite (default: white). */
  modulate: Color;

  /** Render priority within the alpha-blended bucket (default: 0). */
  render_priority: number;
}
