/** Label3D node data. */

import type { GeometryInstance3DProperties } from '../geometryinstance3d/types';
import type { BillboardMode } from '../../../godot/rendering/materials/billboardMode';
import type { Rgba } from '../../../godot/math/math';
import type { HorizontalAlignment, VerticalAlignment } from '../../../godot/math/alignment';
import type { Vector2 } from '../../../godot/math/vector';
import type { AutowrapMode } from '../../../godot/text/textServerEnums';
import type { AlphaCutMode } from '../../../godot/rendering/materials/alphaCut';
import type { TextureFilter } from '../../../godot/rendering/materials/textureFilter';
import type { AlphaAntiAliasing } from '../../../godot/rendering/materials/alphaAntialiasing';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

export interface Label3DProperties extends GeometryInstance3DProperties {
  text: string;

  /** The raw `font` property, a reference into the scene's font resources. Absent draws the project font. */
  font?: string;

  /** Size of one pixel's width in 3D world units (default 0.005). */
  pixel_size: number;

  /**
   * Billboard mode. Default BILLBOARD_DISABLED, as for Sprite3D
   * (`Component.parity.test.tsx`).
   */
  billboard: EnumValue<typeof BillboardMode>;

  /** Text tint (default white). */
  modulate: Rgba;

  /** Outline thickness in pixels (default 12). */
  outline_size: number;

  /** Outline colour (default black). */
  outline_modulate: Rgba;

  /** Visible from behind (Godot default true → THREE.DoubleSide). */
  double_sided: boolean;

  /** Lit by the scene's 3D lights, `SHADING_MODE_PER_PIXEL` (`material.cpp:3045`, default false). */
  shaded: boolean;

  /** Glyph size in Godot pixels; drives the quad's world size (default 32). */
  font_size: number;

  /**
   * Extra vertical space between lines, in Godot pixels, added to each line's
   * descent (default 0). May be negative.
   */
  line_spacing: number;

  /** Horizontal alignment of each line (default 1 = CENTER). FILL stretches each line to `width`. */
  horizontal_alignment: EnumValue<typeof HorizontalAlignment>;

  /** Where the block of lines sits against the origin (`label_3d.h:108`, default CENTER). FILL acts as TOP. */
  vertical_alignment: EnumValue<typeof VerticalAlignment>;

  /** Shapes the text in upper case before it breaks the lines (`label_3d.h:111`, default false). */
  uppercase: boolean;

  /** Break width in px (`label_3d.h:116`, default 500). Zero or less wraps nothing. */
  width: number;

  /** How the text breaks at `width` (`label_3d.h:113`, default OFF). */
  autowrap_mode: EnumValue<typeof AutowrapMode>;

  /** `BREAK_TRIM_*` bits (`label_3d.h:114`, default: trim the spaces at both edges of a line). */
  autowrap_trim_flags: number;

  /** `JUSTIFICATION_*` bits that FILL reads (`label_3d.h:115`). */
  justification_flags: number;

  /** Moves every line by this many px, a positive y up (`label_3d.h:122`, default zero). */
  offset: Vector2;

  /** Draw on top of everything regardless of depth (default false). */
  no_depth_test: boolean;

  /** Paint order of the fill surface (`label_3d.h:124`, default 0). */
  render_priority: number;

  /** Paint order of the outline surface (`label_3d.h:123`, default -1, behind the fill). */
  outline_render_priority: number;

  /** Transparency mode (`label_3d.h:61`, default DISABLED). */
  alpha_cut: EnumValue<typeof AlphaCutMode>;

  /** Scissor cut used by `alpha_cut` DISCARD (`label_3d.h:62`, default 0.5). */
  alpha_scissor_threshold: number;

  /** Grain of the `alpha_cut` HASH dither (`label_3d.h:63`, default 1.0). */
  alpha_hash_scale: number;

  /** Alpha antialiasing of a DISCARD or HASH cut (`label_3d.h:64`, default OFF). */
  alpha_antialiasing_mode: EnumValue<typeof AlphaAntiAliasing>;

  /** Where the antialiased cut's edge sits (`label_3d.h:65`, default 0). */
  alpha_antialiasing_edge: number;

  /** Keep a constant on-screen size regardless of distance (`label_3d.h:46`, default false). */
  fixed_size: boolean;

  /** Glyph-texture sampling (`label_3d.h:140`, default LINEAR_WITH_MIPMAPS). */
  texture_filter: EnumValue<typeof TextureFilter>;
}
