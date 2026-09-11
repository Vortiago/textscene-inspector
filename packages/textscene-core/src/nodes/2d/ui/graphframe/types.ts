import type { ControlColor } from '../control/types';
import type { GraphElementProperties } from '../graphelement/types';

export interface GraphFrameProperties extends GraphElementProperties {
  /** `title` — `graph_frame.cpp:192`. Default `""` (`graph_frame.h:51`, `String title;`). */
  title?: string;
  /** `autoshrink_enabled` — `graph_frame.cpp:193`. Default `true` (`graph_frame.h:56`). */
  autoshrinkEnabled?: boolean;
  /** `autoshrink_margin` — `graph_frame.cpp:194`, `PROPERTY_HINT_RANGE "0,128,1"`. Default `40` (`graph_frame.h:57`). */
  autoshrinkMargin?: number;
  /** `drag_margin` — `graph_frame.cpp:195`, `PROPERTY_HINT_RANGE "0,128,1"`. Default `16` (`graph_frame.h:58`). */
  dragMargin?: number;
  /** `tint_color_enabled` — `graph_frame.cpp:197`. Default `false` (`graph_frame.h:60`). */
  tintColorEnabled?: boolean;
  /** `tint_color` — `graph_frame.cpp:198`. Default `Color(0.3, 0.3, 0.3, 0.75)` (`graph_frame.h:61`). */
  tintColor?: ControlColor;
}
