/**
 * AspectRatioContainer's native (WebGL canvas) painter. A Container draws no chrome,
 * and `ControlCanvasWalker` places the node and its children. The registration stops
 * the walker from drawing the `ControlFallback` debug outline for the node.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function AspectRatioContainer(_props: NativeControlComponentProps) {
  return null;
}
