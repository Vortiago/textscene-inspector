/**
 * The root canvas of a viewport. Each Viewport draws a canvas of its own (`viewport.cpp:5345`), so
 * a CanvasLayer around the viewport hands its items neither its layer index nor its frame.
 */

import type { ReactNode } from 'react';
import { CanvasFrameContext } from './canvasFrame.js';
import { CanvasLayerIndexProvider, WORLD_CANVAS_LAYER } from './lighting2d/canvasItemPlacement.js';

export function ViewportCanvasScope({ children }: { children: ReactNode }) {
  return (
    <CanvasLayerIndexProvider value={WORLD_CANVAS_LAYER}>
      <CanvasFrameContext.Provider value={null}>{children}</CanvasFrameContext.Provider>
    </CanvasLayerIndexProvider>
  );
}
