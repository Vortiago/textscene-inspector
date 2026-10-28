/**
 * The layout direction a sub-viewport's Controls inherit: `is_layout_rtl()` of the Control around
 * the viewport, read from the live tree by the viewport's path.
 */
import { useMemo } from 'react';

import { useLayoutDirectionEnv } from '../../../r3f/contexts/useLayoutDirectionEnv.js';
import { liveTreeOf } from '../../../r3f/liveSceneTree.js';
import { useSharedLiveTree } from '../../../r3f/useLiveSceneTree.js';
import { inheritedRtlAt } from './controlRasterViewports.js';

export function useInheritedRtl(path: string): boolean | null {
  const live = useSharedLiveTree();
  const layoutDirectionEnv = useLayoutDirectionEnv();
  return useMemo(
    () => (live ? inheritedRtlAt(liveTreeOf(live.roots, live.ctx), path, layoutDirectionEnv) : null),
    [live, path, layoutDirectionEnv]
  );
}
