/** CenterContainer property definitions. */

import type { ControlProperties } from '../control/types';

export interface CenterContainerProperties extends ControlProperties {
  /**
   * `CenterContainer.use_top_left` (`center_container.h:38`, default `false`).
   * When true `get_minimum_size` returns `(0, 0)` (not the child's minimum)
   * and `_notification`'s `NOTIFICATION_SORT_CHILDREN` centres the child on
   * the CONTAINER's own top-left corner instead of its centre
   * (`center_container.cpp:34-36,83`) — the child straddles the origin
   * rather than sitting inside the container's rect.
   */
  useTopLeft?: boolean;
}
