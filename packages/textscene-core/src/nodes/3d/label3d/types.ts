/**
 * Label3D types and interfaces
 */

import type { Node3DProperties } from '../../base/node3d/types';
import type { Color } from '../../../utils/colorParser';

/**
 * Billboard modes for Label3D
 * Based on BaseMaterial3D.BillboardMode enum in Godot
 */
export enum BillboardMode {
  /** Billboard disabled - text faces forward */
  BILLBOARD_DISABLED = 0,
  /** Billboard enabled - text always faces camera */
  BILLBOARD_ENABLED = 1,
  /** Billboard Y-axis only - text rotates around Y to face camera */
  BILLBOARD_FIXED_Y = 2,
  /** Billboard particles mode - not supported in Label3D */
  BILLBOARD_PARTICLES = 3,
}

export interface Label3DProperties extends Node3DProperties {
  /** The text to display */
  text: string;

  /** Size of one pixel's width in 3D world units (default: 0.01) */
  pixel_size: number;

  /**
   * Billboard mode. Default: BILLBOARD_DISABLED — a deliberate parser
   * default (see `Component.parity.test.tsx`: "was ENABLED → labels
   * wrongly tracked camera"), same as Sprite3D's default.
   */
  billboard: BillboardMode;

  /** Text color/tint (default: white) */
  modulate: Color;

  /** Outline thickness in pixels (default: 0) */
  outline_size: number;

  /** Outline color (default: black) */
  outline_modulate: Color;

  /** Visible from behind (Godot default true → THREE.DoubleSide). */
  double_sided: boolean;

  /** Glyph size in Godot pixels; drives the quad's world size (default 32). */
  font_size: number;

  /**
   * Extra vertical space between lines, in Godot pixels, added to each line's
   * descent (default 0). May be negative.
   */
  line_spacing: number;

  /** Horizontal alignment of each line within the quad (default 1 = CENTER). */
  horizontal_alignment: HorizontalAlignment;

  /** Draw on top of everything regardless of depth (default false). */
  no_depth_test: boolean;

  /** Paint order of the fill surface (`label_3d.h:124`, default 0). */
  render_priority: number;

  /** Paint order of the outline surface (`label_3d.h:123`, default -1 — behind the fill). */
  outline_render_priority: number;

  /** Transparency mode (`label_3d.h:61`, default DISABLED). */
  alpha_cut: AlphaCutMode;

  /** Glyph-texture sampling (`label_3d.h:140`, default LINEAR_WITH_MIPMAPS). */
  texture_filter: TextureFilter;
}

/** `BaseMaterial3D::TextureFilter` (`scene/resources/material.h:172-178`). */
export enum TextureFilter {
  NEAREST = 0,
  LINEAR = 1,
  NEAREST_WITH_MIPMAPS = 2,
  LINEAR_WITH_MIPMAPS = 3,
  NEAREST_WITH_MIPMAPS_ANISOTROPIC = 4,
  LINEAR_WITH_MIPMAPS_ANISOTROPIC = 5,
}

/** `Label3D::AlphaCutMode` (`scene/3d/label_3d.h:50-56`). */
export enum AlphaCutMode {
  DISABLED = 0,
  DISCARD = 1,
  OPAQUE_PREPASS = 2,
  HASH = 3,
}

/** Godot's `HorizontalAlignment` enum, as it appears in `.tscn` files. */
export enum HorizontalAlignment {
  LEFT = 0,
  CENTER = 1,
  RIGHT = 2,
  FILL = 3,
}
