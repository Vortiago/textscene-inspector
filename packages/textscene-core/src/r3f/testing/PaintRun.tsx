/**
 * Mounts a subtree at a run of draw sequences with no shared live tree above it, as a component
 * test mounts one drawn item. Test-only, like the rest of `testing/`.
 */

import { useMemo, type ReactNode } from 'react';
import type { PaintRange } from '../canvasPaintOrder';
import { PaintFrameProvider, runFrameAt } from '../canvasItemPass/nodePaint';

export function PaintRun({ value, children }: { value: PaintRange; children: ReactNode }) {
  const frame = useMemo(() => runFrameAt(value), [value]);
  return <PaintFrameProvider value={frame}>{children}</PaintFrameProvider>;
}
