/**
 * `<GraphElement>` draws nothing: `graph_element.cpp` has no `NOTIFICATION_DRAW`
 * case. It is registered so `ControlCanvasWalker` draws no `ControlFallback`
 * debug outline for a bare `GraphElement` node.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function GraphElement(_props: NativeControlComponentProps) {
  return null;
}
