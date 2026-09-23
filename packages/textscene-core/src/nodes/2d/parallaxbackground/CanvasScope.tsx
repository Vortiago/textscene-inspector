/**
 * Paints the canvas a ParallaxBackground's Control children draw on, in the
 * Control walk. `_enter_canvas` stops at a CanvasLayer (`scene/main/canvas_item.cpp:246-252`),
 * which ParallaxBackground is (`scene/2d/parallax_background.h:34`), so without this
 * scope a Control would hoist onto the viewport canvas, above the world.
 */
import type { NativeControlComponentProps } from '../../../r3f/controls/ControlComponentRegistry';
import { CanvasLayerScope } from '../../../r3f/canvasLayerScope';
import type { ParallaxBackgroundProperties } from './types';

export function ParallaxBackgroundCanvasScope({ solveNode, children }: NativeControlComponentProps) {
  // painter-view-exempt: `ParallaxBackgroundProperties` is not a `ControlProperties`: a CanvasLayer is a Node.
  const props = solveNode.node.properties as ParallaxBackgroundProperties;

  if (props.visible === false) return null;

  // The scroll and the cut ancestor chain are the world walk's half (`Component.tsx`).
  // The shared `<CanvasLayerScope>` keeps this canvas in step with the CanvasLayer painter.
  return <CanvasLayerScope node={solveNode.node}>{children}</CanvasLayerScope>;
}
