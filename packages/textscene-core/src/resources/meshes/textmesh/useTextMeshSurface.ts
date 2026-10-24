/**
 * A TextMesh's surface as a hook. The surface needs the outlines of the mesh's `font` and the
 * metrics that font shapes with, and both arrive after the scene does.
 */

import { useMemo, useSyncExternalStore } from 'react';
import type { TscnInternalResource } from '../../../parser/types';
import type { GodotSurface } from '../godotSurface';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import {
  onSceneFontMetricsSettled,
  peekSettledSceneFontMetrics,
  sceneFontSettleCount,
} from '../../../r3f/controls/native/text/sceneFontLoader';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { useFontResource } from '../../fonts/font/useFontResource';
import { resourceContentKey } from '../../resourceContentKey';
import type { ScopedResource } from '../../scopedResource';
import { useContentMemo } from '../../useContentMemo';
import { usePendingWhile } from '../../usePendingWhile';
import { fontOutlines } from './fontOutlines';
import { textMeshSurface } from './surface';

export const TEXT_MESH_TYPE = 'TextMesh';

export interface TextMeshSurface {
  /** Null while it loads, and for a font with no TrueType outlines or no font at all. */
  surface: GodotSurface | null;
  /** True while a font file or the font's metrics are still to arrive. */
  isLoading: boolean;
}

const NO_RESOURCES: SceneResources = { internalResources: [], externalResources: [] };
const UNDRAWN: TextMeshSurface = { surface: null, isLoading: false };
const LOADING: TextMeshSurface = { surface: null, isLoading: true };

const sameResource = (resource: TscnInternalResource) => resource;

// A mesh with no outlines has no metrics to wait for, so it subscribes to nothing and never
// re-renders when a font elsewhere settles.
const subscribeToNothing = () => () => {};
const noSettleCount = () => 0;

/** `scoped` is null for any resource but a TextMesh. */
export function useTextMeshSurface(scoped: ScopedResource | null, texelSize: number): TextMeshSurface {
  const nodePath = useNodePath() ?? '';
  const { font, isLoading: isLoadingFile } = useFontResource(
    scoped?.resource.data['font'],
    scoped?.resources ?? NO_RESOURCES
  );
  // Every keystroke parses the scene afresh. The first resource of equal content stands for the
  // rest, so an edit elsewhere neither rebuilds the surface nor uploads its geometry again.
  const resource = useContentMemo(scoped?.resource, resourceContentKey, sameResource);
  const outlines = useMemo(() => fontOutlines(font), [font]);
  // The count is the snapshot: a metrics load that settles re-reads the peek below.
  const settleCount = useSyncExternalStore(
    outlines ? onSceneFontMetricsSettled : subscribeToNothing,
    outlines ? sceneFontSettleCount : noSettleCount,
    outlines ? sceneFontSettleCount : noSettleCount
  );
  const metrics = useMemo(
    () => (outlines ? peekSettledSceneFontMetrics(font, nodePath) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `settleCount` is a cache-buster.
    [outlines, font, nodePath, settleCount]
  );
  const isLoadingMetrics = outlines !== null && metrics === null;
  usePendingWhile(isLoadingMetrics);

  return useMemo(() => {
    if (!resource) return UNDRAWN;
    if (isLoadingFile || isLoadingMetrics) return LOADING;
    if (!outlines || !metrics) return UNDRAWN;
    return { surface: textMeshSurface(resource, { outlines, metrics }, texelSize), isLoading: false };
  }, [resource, isLoadingFile, isLoadingMetrics, outlines, metrics, texelSize]);
}
