/**
 * Picks the workspace from the root's type on each new scene (ADR-0006): a
 * CanvasItem gives 2D, a Node3D gives 3D, a plain Node keeps the current one.
 * The root is merged through the live tree first, so an instanced root claims
 * its sub-scene's workspace once that loads.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { workspaceForRoot } from '../../workspaceForScene.js';
import { useSharedLiveTree } from '../../useLiveSceneTree.js';
import { collapseLiveNode, rootScope, snapshotScenes } from '../../liveSceneTree.js';

export function WorkspaceAutoSelect({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { setMode } = useViewportMode();
  const lt = useSharedLiveTree();

  const claimed = useMemo(() => {
    const root = lt?.roots[0];
    if (!lt || !root) return null;
    return workspaceForRoot(collapseLiveNode(root, rootScope(lt.ctx), snapshotScenes(lt.ctx)));
  }, [lt]);

  // Once per scene, when the workspace becomes known. A manual toggle then
  // holds until the next scene switch.
  const appliedFor = useRef<SceneGraph | null>(null);
  useEffect(() => {
    if (claimed && appliedFor.current !== sceneGraph) {
      appliedFor.current = sceneGraph;
      setMode(claimed);
    }
  }, [sceneGraph, claimed, setMode]);

  return null;
}
