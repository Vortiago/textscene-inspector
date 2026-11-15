/**
 * Test-only: the 2D light pass over `nodes` with a white canvas tint, so a light draws its own colour,
 * run on every frame as the stage runs it.
 */

import type { ReactNode } from 'react';
import { CanvasLighting2DProvider } from '../CanvasLighting2D';
import { canvasColorSpaceOf } from '../../canvasColorSpace';
import { CanvasFrameDriver } from '../../testing/CanvasFrameDriver';

export function underWhiteCanvasLighting(nodes: ReactNode) {
  return (
    <CanvasFrameDriver>
      <CanvasLighting2DProvider space={canvasColorSpaceOf(false)} canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
        {nodes}
      </CanvasLighting2DProvider>
    </CanvasFrameDriver>
  );
}
