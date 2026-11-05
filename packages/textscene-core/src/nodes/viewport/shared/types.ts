/**
 * The keys every Viewport class serialises. A Viewport is a `Node`, so it has no transform. Defaults
 * are Godot's own (`doc/classes/Viewport.xml`).
 */

import type { NodeProperties } from '../../node/types';
import type { ViewportTextureFilter, ViewportTextureRepeat } from '../../../godot/scene/viewport';

/**
 * `transform` is dropped from the base: a Viewport is not a spatial node, so Godot never
 * serialises one. The parser deletes the field the base `parseNode` reads, which also keeps
 * parser and validator coverage symmetric.
 */
export interface ViewportProperties extends Omit<NodeProperties, 'transform'> {
  /**
   * When true the viewport creates its own World3D, so its 3D descendants stop
   * drawing in the parent's view (ADR-0033). False, the default, shares the
   * parent world. The World2D is always the viewport's own.
   */
  own_world_3d: boolean;
  /** Disables this viewport's own 3D pass. It does not hide 3D children from the parent view. */
  disable_3d: boolean;
  /** When false the target clears to the opaque project clear colour. */
  transparent_bg: boolean;
  handle_input_locally: boolean;
  /** `Viewport.MSAA` of the buffer canvas items draw into. */
  msaa_2d: number;
  /** `Viewport.MSAA` of the buffer the 3D world draws into. */
  msaa_3d: number;
  use_debanding: boolean;
  audio_listener_enable_2d: boolean;
  canvas_item_default_texture_filter: ViewportTextureFilter;
  canvas_item_default_texture_repeat: ViewportTextureRepeat;
  /** Whether a Window below draws inside this viewport rather than a viewport further up. */
  gui_embed_subwindows: boolean;
  /** The mipmap bias of the viewport's 3D material samplers. Absent takes the project setting. */
  texture_mipmap_bias?: number;
  /** The `Viewport.AnisotropicFiltering` of the viewport's textures. Absent takes the project setting. */
  anisotropic_filtering_level?: number;
  /** The side of the viewport's positional shadow atlas. Absent keeps the Viewport default, 2048. */
  positional_shadow_atlas_size?: number;
  /** Each quadrant's `PositionalShadowAtlasQuadrantSubdiv`. Absent keeps the default. */
  positional_shadow_atlas_quad_0?: number;
  positional_shadow_atlas_quad_1?: number;
  positional_shadow_atlas_quad_2?: number;
  positional_shadow_atlas_quad_3?: number;
}
