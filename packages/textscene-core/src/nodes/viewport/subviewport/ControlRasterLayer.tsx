/**
 * Mounts the native offscreen passes for every Control-only sub-viewport in a
 * scene, or nothing at all when there are none.
 *
 * BOTH canvases need this, for the same reason: a Control-only sub-viewport
 * (ADR-0033) still needs its pass driven in whichever canvas is mounted, even
 * where Controls are never drawn on-screen — a `SubViewportContainer` or any
 * other `ViewportTexture` consumer in that canvas may be sampling one. So the
 * hook call, the lazy boundary and the "are there any?" gate live here once
 * rather than being kept in step by hand in two canvases.
 *
 * The import is lazy because the Control renderer (solver, text atlas, every
 * painter) has no business in a canvas's initial bundle; the gate means the
 * chunk is never even requested for a scene without a Control-only viewport.
 */
import { Suspense, lazy } from 'react';
import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../../../parser/types.js';
import { useControlRasterViewports } from './useControlRasterViewports.js';

const ControlRasterPasses = lazy(() =>
  import('./ControlRasterPass.js').then((m) => ({ default: m.ControlRasterPasses }))
);

export interface ControlRasterLayerProps {
  nodes: readonly TscnNode[];
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}

export function ControlRasterLayer({
  nodes,
  internalResources,
  externalResources,
}: ControlRasterLayerProps) {
  const viewports = useControlRasterViewports(nodes, internalResources, externalResources);
  if (viewports.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <ControlRasterPasses viewports={viewports} />
    </Suspense>
  );
}
