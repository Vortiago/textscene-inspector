import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Scene } from '../scene/openScene.js';
import type { CameraState } from '../scene/viewportCameras.js';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { ROOT_VIEWPORT_PATH } from './contexts/EnclosingViewportContext.js';
// The scene reads its cameras off the Live scene tree that this binds.
import './sceneLiveTree.js';

type CurrentCamera = (scene: Scene, viewport: string | null) => string | null;

/** A load can enter a camera and a call can move one, so a reader hears both. */
export function subscribeToCameras(scene: Scene | undefined, listener: () => void): () => void {
  if (!scene) return () => {};
  const stopViews = scene.subscribe(listener);
  const stopTree = scene.observe(null, listener);
  return () => {
    stopViews();
    stopTree();
  };
}

/** The In-game view's root viewport is the scene's root window. */
function sceneViewportOf(viewportPath: string | null): string | null {
  return viewportPath === ROOT_VIEWPORT_PATH ? null : viewportPath;
}

function useCameraSubscription(): {
  scene: Scene | undefined;
  subscribe: (listener: () => void) => () => void;
} {
  const scene = useOptionalHierarchy()?.scene;
  const subscribe = useCallback((listener: () => void) => subscribeToCameras(scene, listener), [scene]);
  return { scene, subscribe };
}

function useCurrentCamera(read: CurrentCamera, viewportPath: string | null): string | null {
  const { scene, subscribe } = useCameraSubscription();
  return useSyncExternalStore(subscribe, () => (scene ? read(scene, sceneViewportOf(viewportPath)) : null));
}

/** No node name is empty, so no path holds two slashes in a row and several paths join on them. */
const SNAPSHOT_SEPARATOR = '//';
const NO_CAMERA = '';

/** The current Camera3D of each viewport at `viewportPaths`, null for none, in their order. */
export function useCurrentCameras3D(viewportPaths: readonly string[]): readonly (string | null)[] {
  const { scene, subscribe } = useCameraSubscription();
  const snapshot = useSyncExternalStore(subscribe, () =>
    viewportPaths
      .map((path) => (scene ? scene.currentCamera3D(sceneViewportOf(path)) : null) ?? NO_CAMERA)
      .join(SNAPSHOT_SEPARATOR)
  );
  return useMemo(
    () =>
      viewportPaths.length === 0
        ? []
        : snapshot.split(SNAPSHOT_SEPARATOR).map((path) => (path === NO_CAMERA ? null : path)),
    [snapshot, viewportPaths.length]
  );
}

/** Each camera of the scene by live path: its viewport, whether it is current, and whether it can be. */
export function useSceneCameras(): ReadonlyMap<string, CameraState> {
  const { scene, subscribe } = useCameraSubscription();
  // A string snapshot, since the scene builds a new map on each read.
  const snapshot = useSyncExternalStore(subscribe, () =>
    scene ? JSON.stringify([...scene.cameras().values()]) : '[]'
  );
  return useMemo(
    () => new Map((JSON.parse(snapshot) as CameraState[]).map((camera) => [camera.path, camera])),
    [snapshot]
  );
}

/**
 * The path of the Camera3D the viewport at `viewportPath` draws through, null for none or with no scene.
 *
 * @canonical The camera a viewport renders through
 */
export function useCurrentCamera3D(viewportPath: string | null): string | null {
  return useCurrentCamera((scene, viewport) => scene.currentCamera3D(viewport), viewportPath);
}

/** The path of the viewport's current Camera2D, null for none or with no scene. */
export function useCurrentCamera2D(viewportPath: string | null): string | null {
  return useCurrentCamera((scene, viewport) => scene.currentCamera2D(viewport), viewportPath);
}
