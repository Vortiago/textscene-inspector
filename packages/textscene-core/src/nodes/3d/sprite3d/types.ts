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
  /** Hashed (stochastic) alpha; maps to TRANSPARENCY_ALPHA_HASH (scene/3d/sprite_3d.cpp:291). */
  ALPHA_CUT_HASH = 3,
}

/**
 * `BaseMaterial3D::AlphaAntiAliasing` (`material.h:197-200`), shared verbatim
 * by SpriteBase3D.
 */
export enum AlphaAntiAliasing {
  ALPHA_ANTIALIASING_OFF = 0,
  ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE = 1,
  ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE = 2,
}

/**
 * `BaseMaterial3D::TextureFilter` (`material.h:172-178`). The sampler state per
 * ordinal lives in `resources/textures/godotTextureFilter.ts`.
 */
export enum TextureFilterMode {
  TEXTURE_FILTER_NEAREST = 0,
  TEXTURE_FILTER_LINEAR = 1,
  TEXTURE_FILTER_NEAREST_WITH_MIPMAPS = 2,
  TEXTURE_FILTER_LINEAR_WITH_MIPMAPS = 3,
  TEXTURE_FILTER_NEAREST_WITH_MIPMAPS_ANISOTROPIC = 4,
  TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC = 5,
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

  /** Quad origin centered on the node (default true) vs top-left corner. */
  centered: boolean;

  /** Mirror the texture horizontally / vertically (default false). */
  flip_h: boolean;
  flip_v: boolean;

  /** Visible from behind (Godot default true → THREE.DoubleSide). */
  double_sided: boolean;

  /** Use the texture's alpha for transparency (Godot default true). */
  transparent: boolean;

  /** If true, the texture's `region_rect` defines a sub-image to display. */
  region_enabled: boolean;

  /** Sub-region of the texture to display when `region_enabled` is true. */
  region_rect?: Rect2;

  /** Color tint applied to the sprite (default: white). */
  modulate: Color;

  /**
   * `FLAG_SHADED` — false (SHADING_MODE_UNSHADED) by default; the
   * `SpriteBase3D()` flag loop sets only FLAG_TRANSPARENT and
   * FLAG_DOUBLE_SIDED (`sprite_3d.cpp:712-714`).
   */
  shaded: boolean;

  /** `FLAG_DISABLE_DEPTH_TEST` → `render_mode depth_test_disabled` (`material.cpp:863`). Default false. */
  no_depth_test: boolean;

  /** `FLAG_FIXED_SIZE` — depth-proportional rescale in the vertex shader (`material.cpp:1357`). Default false. */
  fixed_size: boolean;

  /** Alpha-scissor cutoff (`sprite_3d.h:89`). Default 0.5. */
  alpha_scissor_threshold: number;

  /** Alpha-hash dither scale (`sprite_3d.h:90`). Default 1.0. */
  alpha_hash_scale: number;

  /** Alpha antialiasing mode (`sprite_3d.h:91`). Default OFF. */
  alpha_antialiasing_mode: AlphaAntiAliasing;

  /** Alpha-to-coverage edge (`sprite_3d.h:92`). Default 0.0. */
  alpha_antialiasing_edge: number;

  /** Sampler filter for the sprite texture (`sprite_3d.h:94`). Default LINEAR_WITH_MIPMAPS. */
  texture_filter: TextureFilterMode;

  /** Render priority within the alpha-blended bucket (default: 0). */
  render_priority: number;
}
