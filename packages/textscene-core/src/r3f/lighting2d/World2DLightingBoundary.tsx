/**
 * The edge of a canvas's 2D lighting. Every Godot Viewport keeps its own World2D
 * (`viewport.cpp:5345`), so a SubViewport's lights, occluders and CanvasModulate never reach the
 * canvas around it, and its items are not lit or tinted by that canvas. The subtree inside draws
 * unlit under the tint of its own world, as it would outside any light pass.
 */

import type { ReactNode } from 'react';
import { CanvasModulateContext } from '../canvasModulate.js';
import type { Rgba } from '../../godot/math/math.js';
import { CanvasLighting2DContext, INERT_CANVAS_LIGHTING } from './lightPassContext.js';
import { NoShadowCasters } from './ShadowCasterStage.js';

interface World2DLightingBoundaryProps {
  /** The tint of the viewport's own world, white where it holds no visible CanvasModulate. */
  canvasModulate: Rgba;
  children: ReactNode;
}

export function World2DLightingBoundary({ canvasModulate, children }: World2DLightingBoundaryProps) {
  return (
    <CanvasLighting2DContext.Provider value={INERT_CANVAS_LIGHTING}>
      <CanvasModulateContext.Provider value={canvasModulate}>
        <NoShadowCasters>{children}</NoShadowCasters>
      </CanvasModulateContext.Provider>
    </CanvasLighting2DContext.Provider>
  );
}
