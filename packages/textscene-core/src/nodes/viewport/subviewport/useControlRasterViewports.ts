/**
 * The reactive half of `collectControlRasterViewports`: re-walks the scene on every
 * live-tree tick, as `useViewportContentKind` and `useBuildSolveTree` do, since an
 * instanced sub-scene lands after the parse and may hold a Control-only sub-viewport.
 */
import { useMemo } from 'react';

import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { projectLayoutDirectionEnv } from '../../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext.js';
import { useLiveTreeVersion } from '../../../r3f/useLiveSceneTree.js';
import { collectControlRasterViewports, type ControlRasterViewport, type SceneScopeSource } from './controlRasterViewports.js';

/** No PackedScene cache mounted yet (first paint, isolated tests). */
const NO_SCENES: SceneScopeSource = { getCached: () => undefined };

export function useControlRasterViewports(
  nodes: readonly TscnNode[],
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): readonly ControlRasterViewport[] {
  const loader = useResourceLoader();
  const liveTreeVersion = useLiveTreeVersion(loader);
  // `internationalization/*`, reduced to the booleans `is_layout_rtl` branches
  // on: the env `useBuildSolveTree` resolves its Controls against, so the
  // direction handed to a sub-viewport and its Controls' come from one source.
  const projectSettings = useProjectSettings().settings;
  const layoutDirectionEnv = useMemo(() => projectLayoutDirectionEnv(projectSettings), [projectSettings]);

  return useMemo(
    () =>
      collectControlRasterViewports(
        nodes,
        loader?.scenes ?? NO_SCENES,
        { internalResources, externalResources },
        layoutDirectionEnv
      ),
    // `liveTreeVersion` is an intentional cache-buster: it ticks when a
    // sub-scene finishes loading, which is when the walk can find more.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, internalResources, externalResources, loader, layoutDirectionEnv, liveTreeVersion]
  );
}
