/**
 * `<MarginContainerNative>` — the native (WebGL canvas) painter for
 * MarginContainer. MarginContainer draws no chrome of its own in Godot; it
 * only insets its children (`marginContainerLayout`, `nativeSolver.ts`), so
 * this paints nothing. `ControlCanvasWalker` still renders this node's
 * children as siblings regardless of what this component returns.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function MarginContainerNative(_props: NativeControlComponentProps) {
  return null;
}
