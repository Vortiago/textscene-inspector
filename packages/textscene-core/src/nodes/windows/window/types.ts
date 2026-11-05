/**
 * A Window and each class below it that draws as one: Popup and PopupPanel. Its own keys sit beside
 * the viewport face an embedded window shows the sub-viewport passes.
 */

import type { Vector2 } from '../../../godot/math/vector';
import type { ThemeOwnerFields } from '../../2d/ui/control/types';
import type { SubViewportProperties } from '../../viewport/subviewport/types';
import type { ContentScale } from './contentScale';

/**
 * `size`, `render_target_update_mode` and `render_target_clear_mode` are the window's viewport as the
 * embedder sets it (`window.cpp:1552-1563`): the size the scene lines leave, updated with the parent
 * while visible and never while hidden, and cleared on every render. The `size_2d_override` pair keeps
 * the SubViewport defaults, since a Window serialises neither.
 */
export interface WindowProperties extends SubViewportProperties, ThemeOwnerFields {
  title: string;
  /** The top-left of the window's content in its embedder, without the decoration. */
  position: Vector2;
  /** `Window::WindowInitialPosition`. Any value but Absolute centres the window. */
  initial_position: number;
  visible: boolean;
  borderless: boolean;
  /** Whether the window takes focus when it shows. The focused window draws `embedded_border`. */
  unfocusable: boolean;
  always_on_top: boolean;
  /** An exclusive window under an always-on-top window rises with it (`viewport.cpp:279-281`). */
  exclusive: boolean;
  wrap_controls: boolean;
  /** A native window draws outside the game frame, so the embedder draws nothing for it. */
  force_native: boolean;
  min_size: Vector2;
  max_size: Vector2;
  /** The `content_scale_*` keys (`contentScale.ts`). */
  content_scale: ContentScale;
}
