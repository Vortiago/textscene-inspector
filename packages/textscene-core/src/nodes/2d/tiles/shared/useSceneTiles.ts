/**
 * The scene tiles of a tile layer as the live tree holds them: the instance children it adds after
 * its authored ones, and the tiles the editor marks with a disc (`r3f/liveSceneTiles.ts`).
 */

import { useMemo } from 'react';
import type { SceneScope, TscnNode } from '../../../../parser/types';
import type { SceneTileCell } from '../../../../resources/tileset/sceneTileCells';
import { useInstancedScenePaths } from '../../../../r3f/contexts/InstancedScenePathsContext';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useLiveStepOf } from '../../../../r3f/useLiveSceneTree';

/** What a layer draws for the scene tiles of its cells. */
export interface SceneTileDrawing {
  /** The instance children, in the order of the cells. */
  instances: readonly TscnNode[];
  /** The tiles the editor marks with a placeholder disc: no scene, a refused root or `display_placeholder`. */
  placeholderTiles: readonly SceneTileCell[];
}

const NO_TILES: readonly SceneTileCell[] = [];

export function useSceneTiles(node: TscnNode): SceneTileDrawing {
  const ambient = useSceneResources();
  const enclosingScenePaths = useInstancedScenePaths();
  const scope = useMemo<SceneScope>(
    () => ({ ...ambient, instancedScenePaths: enclosingScenePaths }),
    [ambient, enclosingScenePaths]
  );
  const step = useLiveStepOf(node, scope);
  return useMemo(
    () => ({
      instances: step.groups.filter((group) => group.origin === 'tiles').flatMap((group) => group.children),
      placeholderTiles: step.placeholderTiles ?? NO_TILES,
    }),
    [step]
  );
}
