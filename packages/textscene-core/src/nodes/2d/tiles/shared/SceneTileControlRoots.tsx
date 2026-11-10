/**
 * Mounts the solver of a layer's Control-rooted tile scenes, which reports their rects to the sort.
 * It draws nothing.
 */

import { lazy } from 'react';
import { PendingSuspense } from '../../../../resources/PendingSuspense';
import type { SceneTileDrawing } from './useSceneTileNodes';

const ControlRootRects = lazy(() => import('./ControlRootRects'));

export function SceneTileControlRoots({ drawing }: { drawing: SceneTileDrawing }) {
  if (drawing.controlRoots.length === 0) return null;
  return (
    <PendingSuspense>
      <ControlRootRects roots={drawing.controlRoots} onRects={drawing.onRootRects} />
    </PendingSuspense>
  );
}
