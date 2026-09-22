import type { ControlProperties } from '../control/types';

/**
 * GraphElement's own members — `scene/gui/graph_element.cpp:243-248`. All six
 * carry no `PROPERTY_HINT_RANGE`/enum bound, so every reader below is
 * format-only.
 */
export interface GraphElementProperties extends ControlProperties {
  /** `position_offset` — `graph_element.cpp:243`. Default `Vector2()` (`graph_element.h:49`). */
  positionOffset?: { x: number; y: number };
  /** `resizable` — `graph_element.cpp:244`. Default `false` (`graph_element.h:40`). */
  resizable?: boolean;
  /** `draggable` — `graph_element.cpp:245`. Default `true` (`graph_element.h:42`). */
  draggable?: boolean;
  /** `selectable` — `graph_element.cpp:246`. Default `true` (`graph_element.h:43`). */
  selectable?: boolean;
  /** `selected` — `graph_element.cpp:247`. Default `false` (`graph_element.h:39`). */
  selected?: boolean;
  /** `scaling_menus` — `graph_element.cpp:248`. Default `false` (`graph_element.h:51`). */
  scalingMenus?: boolean;
}
