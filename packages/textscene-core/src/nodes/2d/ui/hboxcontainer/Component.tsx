/**
 * HBoxContainer's native (WebGL canvas) painter draws nothing: a Container has
 * no chrome, and `ControlCanvasWalker` places the children.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function HBoxContainer(_props: NativeControlComponentProps) {
  return null;
}
