/**
 * `<BoxContainer>` — a Container draws no chrome of its own;
 * `ControlCanvasWalker` positions this node's group at its solved rect and
 * renders its children as siblings regardless, so there is nothing left for
 * this component to paint. Identical reasoning to `hboxcontainer/Component.tsx`.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function BoxContainer(_props: NativeControlComponentProps) {
  return null;
}
