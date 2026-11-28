/**
 * The layout direction a sub-viewport's Controls inherit: `is_layout_rtl()` of the Control around
 * the viewport, read from the live tree by the viewport's path.
 */
import { useCallback } from 'react';

import { useLayoutDirectionEnv } from '../../../r3f/contexts/useLayoutDirectionEnv.js';
import { liveTreeOf } from '../../../r3f/liveSceneTree.js';
import { useLiveTreeSelection, type SharedLiveTree } from '../../../r3f/useLiveSceneTree.js';
import { inheritedRtlAt } from './controlRasterViewports.js';

export function useInheritedRtl(path: string): boolean | null {
  const layoutDirectionEnv = useLayoutDirectionEnv();
  const select = useCallback(
    ({ roots, ctx }: SharedLiveTree) => inheritedRtlAt(liveTreeOf(roots, ctx), path, layoutDirectionEnv),
    [path, layoutDirectionEnv]
  );
  return useLiveTreeSelection(select, Object.is) ?? null;
}
