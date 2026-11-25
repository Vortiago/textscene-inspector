import type { ReactNode } from 'react';
import { CanvasModulateContext } from '../canvasModulate.js';
import { CanvasColorSpaceProvider, type CanvasColorSpace } from '../canvasColorSpace.js';
import type { Rgba } from '../../godot/math/math.js';
import { CanvasLighting2DContext, INERT_CANVAS_LIGHTING } from './lightPassContext.js';
import { NoShadowCasters } from './ShadowCasterStage.js';
import { CanvasFrameStepsContext } from '../components/Canvas2DStage/canvasFrameSequence.js';

interface World2DLightingBoundaryProps {
  /** The tint of the viewport's own world, white where it holds no visible CanvasModulate. */
  canvasModulate: Rgba;
  /** The space the viewport's canvas draws in, provided to its items as `CanvasLightPass` does. */
  space: CanvasColorSpace;
  children: ReactNode;
}

/** The edge of a SubViewport's own World2D (`viewport.cpp:5345`): no outer light, occluder or tint. */
export function World2DLightingBoundary({ canvasModulate, space, children }: World2DLightingBoundaryProps) {
  return (
    <CanvasColorSpaceProvider value={space}>
      <CanvasLighting2DContext.Provider value={INERT_CANVAS_LIGHTING}>
        <CanvasModulateContext.Provider value={canvasModulate}>
          <NoShadowCasters>
            <CanvasFrameStepsContext.Provider value={null}>{children}</CanvasFrameStepsContext.Provider>
          </NoShadowCasters>
        </CanvasModulateContext.Provider>
      </CanvasLighting2DContext.Provider>
    </CanvasColorSpaceProvider>
  );
}
