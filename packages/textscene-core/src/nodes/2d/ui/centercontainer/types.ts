/** CenterContainer property definitions. */

import type { ControlProperties } from '../control/types';

export interface CenterContainerProperties extends ControlProperties {
  /**
   * `CenterContainer.use_top_left` (`center_container.h:38`, default `false`).
   * When true `get_minimum_size` returns `(0, 0)`, and the sort centres the child on the
   * container's top-left corner (`center_container.cpp:34-36,83`), so it straddles the origin.
   */
  useTopLeft?: boolean;
}
