/**
 * The canvas an embedder draws its windows on. Godot makes it a canvas of its own at layer 1024
 * (`viewport.cpp:315-317`), so it draws over every CanvasLayer below that layer, with no
 * CanvasModulate, no canvas transform and no inherited tint: the resets of a `CanvasLayer`.
 */
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import { CanvasLayerScope } from '../../../r3f/canvasLayerScope';
import { SUBWINDOW_CANVAS_LAYER } from '../../../godot/rendering/viewport';
import { TRANSFORM2D_IDENTITY } from '../../../godot/math/transform2d';
import type { CanvasLayerProperties } from '../../2d/ui/canvaslayer/types';

const SUBWINDOW_CANVAS_PROPERTIES: CanvasLayerProperties = {
  name: 'subwindow_canvas',
  layer: SUBWINDOW_CANVAS_LAYER,
  canvasTransform: TRANSFORM2D_IDENTITY,
  follow_viewport_enabled: false,
  follow_viewport_scale: 1,
};

/** The subwindow canvas as the CanvasLayer it draws as. It holds no node, so no CanvasModulate. */
const SUBWINDOW_CANVAS: TscnNode = {
  name: 'subwindow_canvas',
  type: 'CanvasLayer',
  children: [],
  rawProperties: {},
  properties: SUBWINDOW_CANVAS_PROPERTIES as unknown as Record<string, unknown>,
} as TscnNode;

export function SubwindowCanvasScope({ children }: { children: ReactNode }) {
  return <CanvasLayerScope node={SUBWINDOW_CANVAS}>{children}</CanvasLayerScope>;
}
