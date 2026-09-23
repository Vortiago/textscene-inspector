/**
 * FlowContainer's native painter, which draws nothing: a Container has no chrome,
 * and `ControlCanvasWalker` places the node and its children. The empty painter
 * replaces the debug outline of `ControlFallback`.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function FlowContainer(_props: NativeControlComponentProps) {
  return null;
}
