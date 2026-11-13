/**
 * Mounts a subtree at a run of draw sequences with no shared live tree above it, as a component
 * test mounts one drawn item. Test-only, like the rest of `testing/`.
 */

import type { ReactNode } from 'react';
import type { PaintRange } from '../canvasPaintOrder';
import { PaintFrameProvider } from '../canvasItemPass/nodePaint';

const NO_CANVAS_ROOTS = new Map();

export function PaintRun({ value, children }: { value: PaintRange; children: ReactNode }) {
  return (
    <PaintFrameProvider value={{ kind: 'run', range: value, canvasRoots: NO_CANVAS_ROOTS }}>
      {children}
    </PaintFrameProvider>
  );
}
