/**
 * The edge of a canvas's 2D lighting. Every Godot Viewport keeps its own World2D
 * (`viewport.cpp:5345`), so a SubViewport's lights and occluders never reach the canvas around it,
 * and its items are not lit by that canvas's lights. The subtree inside draws unlit, as it would
 * outside any light pass.
 */

import type { ReactNode } from 'react';
import { CanvasLighting2DContext, INERT_CANVAS_LIGHTING } from './lightPassContext.js';
import { NoShadowCasters } from './ShadowCasterStage.js';

export function World2DLightingBoundary({ children }: { children: ReactNode }) {
  return (
    <CanvasLighting2DContext.Provider value={INERT_CANVAS_LIGHTING}>
      <NoShadowCasters>{children}</NoShadowCasters>
    </CanvasLighting2DContext.Provider>
  );
}
