/**
 * Mounts a subtree at a run of draw sequences with no shared live tree above it, as a component
 * test mounts one drawn item. Test-only, like the rest of `testing/`.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import type { PaintRange } from '../canvasPaintOrder';
import { PaintFrameProvider, type PaintFrame } from '../canvasItemPass/nodePaint';

const NO_CANVAS_ROOTS: ReadonlyMap<TscnNode, PaintRange> = new Map();

export function PaintRun({ value, children }: { value: PaintRange; children: ReactNode }) {
  const frame = useMemo(
    (): PaintFrame => ({ kind: 'run', range: value, canvasRoots: NO_CANVAS_ROOTS }),
    [value]
  );
  return <PaintFrameProvider value={frame}>{children}</PaintFrameProvider>;
}
