/**
 * `<CanvasLayer>` — the native (WebGL canvas) painter for `CanvasLayer`: a
 * full-rect passthrough that is its OWN canvas, not a Control despite living
 * in the Control tree walk (`TWO_D_UI_TYPES` lists it so `buildSolveTree`
 * gives it a `SolveNode` at all).
 *
 * Draws no chrome of its own — just a wrapper. Registering a painter at all is
 * what stops `ControlCanvasWalker` from falling back to `<ControlFallback>`'s
 * outline box, which would otherwise draw a visible rectangle around the
 * whole layer. The canvas scope itself is `<CanvasLayerScope>`, shared with
 * `NodeDispatcher.tsx`'s Node2D walk so the two cannot drift.
 *
 * `ControlCanvasWalker` renders `children` through this component ONLY for
 * `CanvasLayer` — every other registered painter draws fixed chrome as a
 * sibling of its Control's descendants (`NativeControlComponentProps`'s own
 * doc comment), since nothing else needs a canvas boundary between a Control
 * and what is nested under it.
 *
 * `visible === false` is handled here directly rather than relying solely on
 * the walker's outer group visibility: this component renders nothing,
 * publishing neither context, when hidden — the same "no descendant reaches
 * the scene" contract a hidden ancestor has everywhere else in this codebase.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { CanvasLayerScope } from '../../../../r3f/canvasLayerScope';
import type { CanvasLayerProperties } from './types';

export function CanvasLayer({ solveNode, children }: NativeControlComponentProps) {
  // painter-view-exempt: `CanvasLayerProperties` is not a `ControlProperties` — a CanvasLayer is a Node.
  const props = solveNode.node.properties as CanvasLayerProperties;

  if (props.visible === false) return null;

  return <CanvasLayerScope node={solveNode.node}>{children}</CanvasLayerScope>;
}
