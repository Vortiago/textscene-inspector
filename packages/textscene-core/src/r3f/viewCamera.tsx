import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import * as logger from '../logger.js';
import type { NodeHandle } from '../scene/nodeHandle.js';
import { livePathOf } from '../scene/nodePathWalk.js';
import type { Scene } from '../scene/openScene.js';
import { isCamera3DType } from './cameraNodeTypes.js';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { subscribeToSceneTree } from './currentCamera.js';
import { useSceneCamera } from './sceneCameras.js';

/** Throws for a node of another type at `path`. No node there yet passes, since a load may bring it in. */
export function assertCameraPath(scene: Scene, path: string): void {
  const problem = notACamera(path, scene.getNodeOrNull(path));
  if (problem) throw problem;
}

/** Throws unless a Camera3D is at `path`, for a scene whose loads have ended. */
export function assertLoadedCamera(scene: Scene, path: string): void {
  const node = scene.getNodeOrNull(path);
  if (!node) throw new Error(`expected a Camera3D at "${path}", got no node once the scene loaded`);
  assertCameraPath(scene, path);
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

/** The path the effect last saw, and whether a node at it has left the scene since. */
interface Watched {
  camera: string | null;
  hadNode: boolean;
  hasLeft: boolean;
}

/** Godot keeps a left camera's preview off, also when a node comes back (node_3d_editor_plugin.cpp:4372). */
function noteLeave(watched: Watched, camera: string | null, node: NodeHandle | null): boolean {
  if (watched.camera !== camera) Object.assign(watched, { camera, hadNode: false, hasLeft: false });
  if (node) watched.hadNode = true;
  else if (watched.hadNode) watched.hasLeft = true;
  return watched.hasLeft;
}

/** Godot's Preview check box: null keeps the editor camera's pose (node_3d_editor_plugin.cpp:4491). */
export function ViewCamera({ camera }: { camera: string | null }): null {
  const node = useNodeAt(useOptionalHierarchy()?.scene, camera);
  const livePath = node && isCamera3DType(node.type) ? livePathOf(node.path) : null;
  // The tree holds a node before its camera mounts, and a preview of an unmounted camera ends at once.
  const mounted = useSceneCamera(livePath);
  const watched = useRef<Watched>({ camera, hadNode: false, hasLeft: false });
  const actions = useOptionalViewportActions();
  const previewCamera = actions?.previewCamera;
  const endCameraPreview = actions?.endCameraPreview;
  useEffect(() => {
    if (camera === null) return endCameraPreview?.();
    const problem = notACamera(camera, node);
    if (problem) logger.error(problem.message);
    const hasLeft = noteLeave(watched.current, camera, node);
    // Any other case ends the old preview, so the view never draws a camera it no longer names.
    if (livePath && mounted && !hasLeft) previewCamera?.(livePath);
    else endCameraPreview?.();
  }, [camera, node, livePath, mounted, previewCamera, endCameraPreview]);
  return null;
}
