import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { absolutePathOf } from '../../../scene/nodePathWalk.js';
import type { Scene } from '../../../scene/openScene.js';

/** The Camera3D the shell's 3D view looks through, which the shell hands the view as `camera`. */
export interface PreviewCamera {
  /** The live path of the previewed Camera3D, or null for the editor camera. */
  camera: string | null;
  previewCamera(path: string): void;
  endPreview(): void;
}

const PreviewCameraContext = createContext<PreviewCamera | null>(null);
PreviewCameraContext.displayName = 'PreviewCameraContext';

/** What the preview reads of the scene: whether its camera is still in the tree. */
type WatchedScene = Pick<Scene, 'getNodeOrNull' | 'observe'>;

interface PreviewCameraProviderProps {
  scene: WatchedScene;
  /** A live path to look through on open, such as a deep link's. */
  initialCamera?: string | null;
  children: ReactNode;
}

export function PreviewCameraProvider({ scene, initialCamera = null, children }: PreviewCameraProviderProps) {
  const [camera, setCamera] = useState<string | null>(initialCamera);
  useEndOnLeave(scene, camera, setCamera);
  const value = useMemo<PreviewCamera>(
    () => ({ camera, previewCamera: setCamera, endPreview: () => setCamera(null) }),
    [camera]
  );
  return <PreviewCameraContext.Provider value={value}>{children}</PreviewCameraContext.Provider>;
}

// A linked camera may enter late, so only a node that leaves ends it (node_3d_editor_plugin.cpp:4372).
function useEndOnLeave(scene: WatchedScene, camera: string | null, setCamera: (camera: null) => void): void {
  useEffect(() => {
    if (camera === null) return undefined;
    const path = absolutePathOf(camera);
    let hadNode = scene.getNodeOrNull(path) !== null;
    return scene.observe(null, () => {
      if (scene.getNodeOrNull(path) !== null) hadNode = true;
      else if (hadNode) setCamera(null);
    });
  }, [scene, camera, setCamera]);
}

/** Null outside a shell, where no panel moves the view's camera. */
export function usePreviewCamera(): PreviewCamera | null {
  return useContext(PreviewCameraContext);
}

/** The view's `camera`: the absolute path of the previewed Camera3D, or null for the editor camera. */
export function viewCameraOf(camera: string | null): string | null {
  return camera === null ? null : absolutePathOf(camera);
}
