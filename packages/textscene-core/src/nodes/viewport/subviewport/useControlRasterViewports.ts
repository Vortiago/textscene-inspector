/**
 * The reactive half of `collectControlRasterViewports`: re-walks the scene on
 * every live-tree tick, the same cache-buster `useViewportContentKind` and
 * `useBuildSolveTree` both key their own re-derivation on — an instanced
 * sub-scene lands after the parse, and only then can the walk see whether it
 * holds a Control-only sub-viewport.
 *
 * Kept out of `controlRasterViewports.ts` so the walk itself stays pure and
 * framework-free; only the wiring needs React.
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
  // on — the same env `useBuildSolveTree` resolves its own Controls against,
  // so the direction this walk hands a sub-viewport and the one its Controls
  // resolve below it come from one source.
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
