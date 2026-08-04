/**
 * `<CenterContainer>` — the native (WebGL canvas) painter for
 * CenterContainer. CenterContainer draws no chrome of its own in Godot; it
 * only centres its children (`centerContainerLayout`, `nativeSolver.ts`), so
 * this paints nothing. `ControlCanvasWalker` still renders this node's
 * children as siblings regardless of what this component returns.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function CenterContainer(_props: NativeControlComponentProps) {
  return null;
}
