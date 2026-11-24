import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import type { ParseResult } from '../../../scene/parseScene.js';
import type { Scene } from '../../../scene/openScene.js';
import type { ViewportMode } from '../../viewportMode.js';
import { useViewportMode } from '../ViewportMode/ViewportModeContext.js';
import { useSceneRead } from './sceneRead.js';

/** The root's class picks the workspace once per scene (ADR-0006), an instanced root its sub-scene's. */
export function WorkspaceAutoSelect({ scene }: { scene: Scene }) {
  const { mode, setMode } = useViewportMode();
  const parse = useSyncExternalStore(scene.subscribe, scene.parse);
  const claimed = useSceneRead(scene, workspaceOf);

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

// The editor plugins' `handles` (canvas_item_editor_plugin.cpp:6089, node_3d_editor_plugin.cpp:10434).
async function workspaceOf(root: NodeHandle): Promise<ViewportMode | null> {
  if ((await root.call('is_class', 'CanvasItem')) === true) return '2D';
  if ((await root.call('is_class', 'Node3D')) === true) return '3D';
  return null;
}
