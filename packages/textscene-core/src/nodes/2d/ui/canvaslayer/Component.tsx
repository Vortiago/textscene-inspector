/**
 * `<CanvasLayer>`, a full-rect passthrough that is its own canvas, not a Control. `TWO_D_UI_TYPES`
 * lists it so `buildSolveTree` gives it a `SolveNode`. It draws no chrome, and the registration
 * stops `<ControlFallback>`'s outline. `<CanvasLayerScope>` is shared with `NodeDispatcher.tsx`'s
 * Node2D walk, and this is the one painter the walker renders `children` through.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { CanvasLayerScope } from '../../../../r3f/canvasLayerScope';
import type { CanvasLayerProperties } from './types';

export function CanvasLayer({ solveNode, children }: NativeControlComponentProps) {
  // painter-view-exempt: `CanvasLayerProperties` is not a `ControlProperties`, since a CanvasLayer is a Node.
  const props = solveNode.node.properties as CanvasLayerProperties;

  // Hidden, it publishes neither context, so no descendant reaches the scene.
  if (props.visible === false) return null;

  return <CanvasLayerScope node={solveNode.node}>{children}</CanvasLayerScope>;
}
