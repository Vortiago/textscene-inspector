/**
 * <ScrollContainer> — clips its content and scrolls when it overflows. Provides
 * the 'block' layout kind so its single child flows at its natural size and
 * scrolls within the container's rect. `horizontal_scroll_mode` /
 * `vertical_scroll_mode` (Godot ScrollMode) set each axis' overflow
 * independently; the default (AUTO) scrolls only when content overflows.
 */

import type { CSSProperties } from 'react';
import { createContainerComponent } from '../../../../r3f/controls/createContainerComponent';
import type { ScrollContainerProperties } from './types';

/** Godot ScrollMode → CSS overflow value. */
function scrollOverflow(mode: number | undefined): CSSProperties['overflowX'] {
  switch (mode) {
    case 0: // SCROLL_MODE_DISABLED — no scrolling, content clipped
    case 3: // SCROLL_MODE_SHOW_NEVER — bar hidden; treat as clipped
      return 'hidden';
    case 2: // SCROLL_MODE_SHOW_ALWAYS
    case 4: // SCROLL_MODE_RESERVE — keep the bar's space reserved
      return 'scroll';
    default: // 1 AUTO / absent
      return 'auto';
  }
}

export const ScrollContainer = createContainerComponent<ScrollContainerProperties>({
  typeName: 'ScrollContainer',
  kind: 'block',
  useStyle: (props) => ({
    overflowX: scrollOverflow(props.horizontalScrollMode),
    overflowY: scrollOverflow(props.verticalScrollMode),
  }),
});
