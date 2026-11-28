/**
 * The theme owners above a viewport (`viewportThemeOwners`), read from the live tree by the
 * viewport's path.
 */
import { useCallback } from 'react';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { useLiveTreeSelection, type SharedLiveTree } from '../../../r3f/useLiveSceneTree';
import { NO_OWNERS, viewportThemeOwners, type ThemeOwner } from './themeOwners';

export function useViewportThemeOwners(path: string): readonly ThemeOwner[] {
  const select = useCallback(
    ({ roots, ctx }: SharedLiveTree) => viewportThemeOwners(liveTreeOf(roots, ctx), path),
    [path]
  );
  return useLiveTreeSelection(select, Object.is) ?? NO_OWNERS;
}
