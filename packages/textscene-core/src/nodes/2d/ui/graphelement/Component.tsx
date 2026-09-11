/**
 * `<GraphElement>` — draws no chrome of its own: `graph_element.cpp` has no
 * `NOTIFICATION_DRAW` case. Registered anyway so `ControlCanvasWalker` stops
 * drawing the "no native painter yet" debug outline (`ControlFallback`) for a
 * bare `GraphElement` node, matching `GridContainer`'s own reasoning.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function GraphElement(_props: NativeControlComponentProps) {
  return null;
}
