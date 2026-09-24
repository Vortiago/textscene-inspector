import type { ControlProperties } from '../control/types';

export interface ScrollContainerProperties extends ControlProperties {
  /** Godot ScrollMode (0 DISABLED, 1 AUTO, 2 SHOW_ALWAYS, 3 SHOW_NEVER, 4 RESERVE). */
  horizontalScrollMode?: number;
  verticalScrollMode?: number;
  /** `ScrollContainer.scroll_horizontal`/`scroll_vertical`: the authored content offset, in px. */
  scrollHorizontal?: number;
  scrollVertical?: number;
  /** `ScrollContainer.draw_focus_border` (`scroll_container.h:115`, Godot default `false`). */
  drawFocusBorder?: boolean;
  /** Godot ScrollHintMode (0 DISABLED, 1 ALL, 2 TOP_AND_LEFT, 3 BOTTOM_AND_RIGHT), `scroll_container.h:52-57,91`. */
  scrollHintMode?: number;
}
