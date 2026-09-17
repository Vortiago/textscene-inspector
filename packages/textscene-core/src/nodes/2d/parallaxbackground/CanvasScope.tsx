/**
 * `<ParallaxBackgroundCanvasScope>` — the native (WebGL canvas) painter for
 * `ParallaxBackground` in the CONTROL walk: the canvas its Control children
 * draw on.
 *
 * `_enter_canvas`'s climb tests `Object::cast_to<CanvasLayer>(n)`
 * (`scene/main/canvas_item.cpp:246-252`) and `ParallaxBackground` IS a
 * `CanvasLayer` (`scene/2d/parallax_background.h:34`), so a Control under one
 * parents at THAT canvas — on the layer `ParallaxBackground` defaults to -100,
 * behind the world. Without a painter here the Control walk hoists straight
 * past it onto the viewport's own canvas and the background covers the world
 * instead.
 *
 * The scroll and the cut ancestor chain are the WORLD walk's half
 * (`Component.tsx`); this is only the canvas, published through the same
 * `<CanvasLayerScope>` the `CanvasLayer` painter uses so the two cannot drift.
 */
import type { NativeControlComponentProps } from '../../../r3f/controls/ControlComponentRegistry';
import { CanvasLayerScope } from '../../../r3f/canvasLayerScope';
import type { ParallaxBackgroundProperties } from './types';

export function ParallaxBackgroundCanvasScope({ solveNode, children }: NativeControlComponentProps) {
  // painter-view-exempt: `ParallaxBackgroundProperties` is not a `ControlProperties` — a CanvasLayer is a Node.
  const props = solveNode.node.properties as ParallaxBackgroundProperties;

  if (props.visible === false) return null;

  return <CanvasLayerScope node={solveNode.node}>{children}</CanvasLayerScope>;
}
