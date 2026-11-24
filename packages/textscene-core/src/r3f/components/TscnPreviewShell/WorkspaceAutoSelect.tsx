import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { subscribeToSceneTree } from '../../currentCamera.js';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import type { ParseResult } from '../../../scene/parseScene.js';
import type { Scene } from '../../../scene/openScene.js';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';
import type { ViewportMode } from '../../viewportMode.js';
import * as logger from '../../../logger.js';
import { useViewportMode } from '../ViewportMode/ViewportModeContext.js';

/** The root's class picks the workspace once per scene (ADR-0006), an instanced root its sub-scene's. */
export function WorkspaceAutoSelect({ scene }: { scene: Scene }) {
  const { mode, setMode } = useViewportMode();
  const parse = useSyncExternalStore(scene.subscribe, scene.parse);
  const claimed = useClaimedWorkspace(scene);

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

/** The workspace the root node claims once its `is_class` reads land, null for none or no root. */
function useClaimedWorkspace(scene: Scene): ViewportMode | null {
  const observeTree = useCallback((listener: () => void) => subscribeToSceneTree(scene, listener), [scene]);
  const root = useSyncExternalStore(observeTree, () => rootOf(scene));
  const [claim, setClaim] = useState<{ root: NodeHandle; workspace: ViewportMode | null } | null>(null);
  useEffect(() => {
    if (!root) return undefined;
    let isLatest = true;
    workspaceOf(root)
      .then((workspace) => {
        if (isLatest) setClaim({ root, workspace });
      })
      .catch((error: unknown) => {
        // A new text frees the root during the read, and the new root reads again.
        if (root.isInsideTree()) logger.error(`expected the root's class to read, got ${String(error)}`);
      });
    return () => {
      isLatest = false;
    };
  }, [root]);
  return claim?.root === root ? claim.workspace : null;
}

function rootOf(scene: Scene): NodeHandle | null {
  return scene.getNodeOrNull(ROOT_WINDOW_PATH)?.getChildren()[0] ?? null;
}

// The editor plugins' `handles` (canvas_item_editor_plugin.cpp:6089, node_3d_editor_plugin.cpp:10434).
async function workspaceOf(root: NodeHandle): Promise<ViewportMode | null> {
  if ((await root.call('is_class', 'CanvasItem')) === true) return '2D';
  if ((await root.call('is_class', 'Node3D')) === true) return '3D';
  return null;
}
