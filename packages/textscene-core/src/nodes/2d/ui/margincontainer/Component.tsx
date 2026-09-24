/**
 * `<MarginContainer>`, the native painter, paints nothing: Godot's MarginContainer only insets its
 * children (`marginContainerLayout`). `ControlCanvasWalker` renders the children as siblings whatever
 * this returns.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function MarginContainer(_props: NativeControlComponentProps) {
  return null;
}
