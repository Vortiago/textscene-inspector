import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useThree } from '@react-three/fiber';
import type { Camera } from 'three';
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
  const lookThrough = useContext(LookThroughContext);
  useEffect(() => {
    if (lookThrough) lookThrough.current = NO_LOOK;
    if (camera === null) return endCameraPreview?.();
    const problem = notACamera(camera, node);
    if (problem) logger.error(problem.message);
    const hasLeft = noteLeave(watched.current, camera, node);
    if (!livePath || hasLeft) return endCameraPreview?.();
    // A named camera holds the view pending until a frame draws through it, mounted or not yet.
    if (lookThrough) lookThrough.current = { path: camera, camera: mounted };
    // Any other case ends the old preview, so the view never draws a camera it no longer names.
    if (mounted) previewCamera?.(livePath);
    else endCameraPreview?.();
  }, [camera, node, livePath, mounted, previewCamera, endCameraPreview, lookThrough]);
  useEffect(
    () => () => {
      if (lookThrough) lookThrough.current = NO_LOOK;
    },
    [lookThrough]
  );
  return null;
}

/** The Camera3D the view must draw through before it settles, by path, with its object once mounted. */
interface LookThrough {
  path: string | null;
  camera: Camera | null;
}

/** Written only by `ViewCamera`'s effects. Back to no path when it unmounts or ends its preview. */
const LookThroughContext = createContext<{ current: LookThrough } | null>(null);

export function LookThroughProvider({ children }: { children: ReactNode }) {
  const [lookThrough] = useState(() => ({ current: NO_LOOK }));
  return <LookThroughContext.Provider value={lookThrough}>{children}</LookThroughContext.Provider>;
}

const NO_LOOK: LookThrough = { path: null, camera: null };

/** The path of the camera the next frame must draw through and does not, or null. */
export function useAwaitedCamera(): () => string | null {
  const lookThrough = useContext(LookThroughContext);
  const get = useThree((state) => state.get);
  return useCallback(() => {
    const { path, camera } = lookThrough?.current ?? NO_LOOK;
    return path !== null && get().camera !== camera ? path : null;
  }, [lookThrough, get]);
}
