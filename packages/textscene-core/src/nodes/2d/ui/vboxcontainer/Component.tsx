/**
 * VBoxContainer's native (WebGL canvas) painter. A Container draws no chrome, and
 * `ControlCanvasWalker` positions the node and its solved children, so nothing is left to paint.
 */

import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function VBoxContainer(_props: NativeControlComponentProps) {
  return null;
}
