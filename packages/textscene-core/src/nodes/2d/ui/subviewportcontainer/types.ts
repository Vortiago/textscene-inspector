/**
 * SubViewportContainer: the Control that displays its SubViewport children's render targets (a
 * **viewport surface**, ADR-0033). Godot draws every SubViewport child, stacked in tree order
 * (`SubViewportContainer::_notification(NOTIFICATION_DRAW)`).
 */

import type { ControlProperties } from '../control/types';

export interface SubViewportContainerProperties extends ControlProperties {
  /**
   * When true the child viewports are resized to `container_rect / stretch_shrink`
   * and drawn across the container's whole rect; when false each is drawn at its
   * own `size`, anchored at the container's top-left.
   */
  stretch: boolean;
  /**
   * Integer divisor of the container rect when `stretch` is on: the target renders smaller and is
   * scaled up. Godot `ERR_FAIL_COND(p_shrink < 1)`. Ignored when `stretch` is false.
   */
  stretch_shrink: number;
}
