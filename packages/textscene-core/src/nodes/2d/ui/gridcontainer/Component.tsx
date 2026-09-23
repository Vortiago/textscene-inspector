/**
 * GridContainer's native (WebGL canvas) painter draws nothing: a Container has
 * no chrome, and `ControlCanvasWalker` places the children. It is registered so
 * the walker draws no `ControlFallback` debug outline for a GridContainer.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function GridContainer(_props: NativeControlComponentProps) {
  return null;
}
