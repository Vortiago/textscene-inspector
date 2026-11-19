import { useCallback, useEffect, useSyncExternalStore } from 'react';
import * as logger from '../logger.js';
import type { NodeHandle } from '../scene/nodeHandle.js';
import { livePathOf } from '../scene/nodePathWalk.js';
import type { Scene } from '../scene/openScene.js';
import { isCamera3DType } from './cameraNodeTypes.js';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { subscribeToSceneTree } from './currentCamera.js';

/** Throws for a node of another type at `path`. No node there yet passes, since a load may bring it in. */
export function assertCameraPath(scene: Scene, path: string): void {
  const problem = notACamera(path, scene.getNodeOrNull(path));
  if (problem) throw problem;
}

function notACamera(path: string, node: NodeHandle | null): Error | null {
  if (!node || isCamera3DType(node.type)) return null;
  return new Error(`expected a Camera3D at "${path}", got a ${node.type}`);
}

/** The node at `path` from the scene's root, read again after each load or write that changes the tree. */
function useNodeAt(scene: Scene | undefined, path: string | null): NodeHandle | null {
  const subscribe = useCallback((listener: () => void) => subscribeToSceneTree(scene, listener), [scene]);
  return useSyncExternalStore(subscribe, () => (scene && path !== null ? scene.getNodeOrNull(path) : null));
}

/** Godot's Preview check box (node_3d_editor_plugin.cpp:4480). For null, the editor camera's start orbit. */
export function ViewCamera({ camera }: { camera: string | null }): null {
  const node = useNodeAt(useOptionalHierarchy()?.scene, camera);
  const actions = useOptionalViewportActions();
  const previewCamera = actions?.previewCamera;
  const endCameraPreview = actions?.endCameraPreview;
  const resetCamera = actions?.resetCamera;
  useEffect(() => {
    if (camera === null) {
      resetCamera?.();
      return;
    }
    const problem = notACamera(camera, node);
    if (problem) logger.error(problem.message);
    // A path with no Camera3D yet ends the old preview, so the view never draws a camera it no longer names.
    if (node && !problem) previewCamera?.(livePathOf(node.path));
    else endCameraPreview?.();
  }, [camera, node, previewCamera, endCameraPreview, resetCamera]);
  return null;
}
