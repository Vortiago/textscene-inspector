/**
 * The theme owners above a viewport (`viewportThemeOwners`), read from the live tree by the
 * viewport's path.
 */
import { useMemo } from 'react';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { useSharedLiveTree } from '../../../r3f/useLiveSceneTree';
import { viewportThemeOwners, type ThemeOwner } from './themeOwners';

const NO_OWNERS: readonly ThemeOwner[] = [];

export function useViewportThemeOwners(path: string): readonly ThemeOwner[] {
  const live = useSharedLiveTree();
  return useMemo(
    () => (live ? viewportThemeOwners(liveTreeOf(live.roots, live.ctx), path) : NO_OWNERS),
    [live, path]
  );
}
