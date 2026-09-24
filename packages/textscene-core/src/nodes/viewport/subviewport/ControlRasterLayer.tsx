/**
 * Mounts the native offscreen passes for every Control-only sub-viewport
 * (ADR-0033), for both canvases, since a consumer in either may sample one. The
 * Control renderer loads lazily, and only for a scene that has such a viewport.
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
