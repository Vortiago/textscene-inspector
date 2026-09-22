/**
 * FlowContainer's native (WebGL canvas) painter — a Container draws no
 * chrome of its own; `ControlCanvasWalker` positions this node's group at
 * its solved rect and renders its (already-solved, self-positioning)
 * children as siblings regardless, so there is nothing left for this
 * component to paint. Registered anyway so `ControlCanvasWalker` stops
 * drawing the "no native painter yet" debug outline (`ControlFallback`) for
 * every FlowContainer in the scene.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function FlowContainer(_props: NativeControlComponentProps) {
  return null;
}
