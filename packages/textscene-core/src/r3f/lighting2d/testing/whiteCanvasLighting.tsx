/** Test-only: the 2D light pass over `nodes` with a white canvas tint, so a light draws its own colour. */

import type { ReactNode } from 'react';
import { CanvasLighting2DProvider } from '../CanvasLighting2D';

export function underWhiteCanvasLighting(nodes: ReactNode) {
  return (
    <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>{nodes}</CanvasLighting2DProvider>
  );
}
