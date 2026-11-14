/**
 * Mounts a subtree at a run of draw sequences with no shared live tree above it, as a component
 * test mounts one drawn item. Test-only, like the rest of `testing/`.
 */

import { useMemo, type ReactNode } from 'react';
import type { PaintRange } from '../canvasPaintOrder';
import { PaintFrameProvider } from '../canvasItemPass/nodePaint';
import { detachedFrame } from './detachedPaint';

export function PaintRun({ value, children }: { value: PaintRange; children: ReactNode }) {
  const frame = useMemo(() => detachedFrame(value), [value]);
  return <PaintFrameProvider value={frame}>{children}</PaintFrameProvider>;
}
