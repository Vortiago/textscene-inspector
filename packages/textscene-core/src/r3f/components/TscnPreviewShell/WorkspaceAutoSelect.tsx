import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { subscribeToSceneTree } from '../../currentCamera.js';
import type { ParseResult } from '../../../scene/parseScene.js';
import type { Scene } from '../../../scene/openScene.js';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { workspaceForRootType } from '../../workspaceForScene.js';

/** The root's class picks the workspace once per scene (ADR-0006), an instanced root its sub-scene's. */
export function WorkspaceAutoSelect({ scene }: { scene: Scene }) {
  const { mode, setMode } = useViewportMode();
  const parse = useSyncExternalStore(scene.subscribe, scene.parse);
  const observeTree = useCallback((listener: () => void) => subscribeToSceneTree(scene, listener), [scene]);
  const rootType = useSyncExternalStore(observeTree, () => rootTypeOf(scene));
  const claimed = workspaceForRootType(rootType);

  // Once per scene, so a manual toggle holds until a switch. No root claims In-game, so a switch keeps it.
  const appliedFor = useRef<ParseResult | null>(null);
  useEffect(() => {
    if (claimed && appliedFor.current !== parse) {
      appliedFor.current = parse;
      if (mode !== 'in-game') setMode(claimed);
    }
  }, [parse, claimed, mode, setMode]);

  return null;
}

function rootTypeOf(scene: Scene): string | null {
  return scene.getNodeOrNull(ROOT_WINDOW_PATH)?.getChildren()[0]?.type ?? null;
}
