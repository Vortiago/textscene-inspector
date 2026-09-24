/**
 * SubViewport: a Viewport that renders its subtree into an offscreen target. It is
 * a `Node`, so it has no transform. Defaults are Godot's own
 * (`doc/classes/SubViewport.xml`, `Viewport.xml`).
 */

import type { NodeProperties } from '../../node/types';
import type { Vector2 } from '../../base/node2d/types';

/** `SubViewport.UpdateMode`: when the target is re-rendered. */
export const UPDATE_MODE_DISABLED = 0;
export const UPDATE_MODE_ONCE = 1;
export const UPDATE_MODE_WHEN_VISIBLE = 2;
export const UPDATE_MODE_WHEN_PARENT_VISIBLE = 3;
export const UPDATE_MODE_ALWAYS = 4;

/** `SubViewport.ClearMode`: how the target is cleared before a render. */
export const CLEAR_MODE_ALWAYS = 0;
export const CLEAR_MODE_NEVER = 1;
export const CLEAR_MODE_ONCE = 2;

/**
 * `transform` is dropped from the base: a Viewport is not a spatial node, so
 * Godot never serialises one. The slice parser deletes the field the base
 * `parseNode` reads, which also keeps parser and validator coverage symmetric.
 */
export interface SubViewportProperties extends Omit<NodeProperties, 'transform'> {
  /** Target size in pixels. Overwritten by a stretching SubViewportContainer. */
  size: Vector2;
  /** 2D-only size override; `(0, 0)` means unused. */
  size_2d_override: Vector2;
  size_2d_override_stretch: boolean;
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
  render_target_update_mode: number;
  render_target_clear_mode: number;
  msaa_3d: number;
  use_debanding: boolean;
  audio_listener_enable_2d: boolean;
  canvas_item_default_texture_filter: number;
  gui_embed_subwindows: boolean;
}
