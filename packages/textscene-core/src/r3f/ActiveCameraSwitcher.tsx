/** Switches the 3D canvas between the editor camera and a previewed scene Camera3D. */
import { useThree, type RootState } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { fitToAspect, fittedAspect } from '../nodes/3d/camera3d/projectionFit.js';
import { EditorControlsHandle } from './EditorControlsHandle.js';
import { useSceneCamera } from './sceneCameras.js';

/** Fits a node camera, which mounts at a placeholder 16/9 aspect, to the live canvas. */
function fitToCanvas(camera: THREE.Camera, size: RootState['size']): void {
  if (size.height <= 0) return;
  const aspect = size.width / size.height;
  if (fittedAspect(camera) !== aspect) fitToAspect(camera, aspect);
}

/**
 * Makes the Camera3D the user previews the render camera of the 3D canvas, whichever scene
 * mounts it. With no preview, the canvas draws through the editor camera at the pose it had.
 */
export function ActiveCameraSwitcher() {
  const control = useOptionalViewportActions();
  const previewedCameraPath = control?.previewedCameraPath ?? null;
  const endCameraPreview = control?.endCameraPreview;
  const hierarchy = useOptionalHierarchy();
  // Re-run when the scene loads: a deep-linked (`?camera=`) path is set before
  // any Camera3D has mounted, so the first pass finds nothing.
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const target = useSceneCamera(previewedCameraPath);
  const camera = useThree((s) => s.camera);
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  // Tells an intentional activation from an incidental effect re-run.
  const prevPathRef = useRef<string | null>(previewedCameraPath);
  const seedConsumedRef = useRef(false);

  useEffect(() => {
    const pathChanged = prevPathRef.current !== previewedCameraPath;
    prevPathRef.current = previewedCameraPath;
    const { controls } = get();
    const editor = controls instanceof EditorControlsHandle ? controls : null;
    const isPreviewing = editor?.isPreviewing(camera) ?? false;

    if (!previewedCameraPath) {
      // Godot re-attaches its editor camera when a preview ends (`node_3d_editor_plugin.cpp:4486-4492`).
      if (editor && isPreviewing) set({ camera: editor.camera });
      return;
    }
    if (!target) {
      // Godot ends the preview of a camera that leaves the scene (`node_3d_editor_plugin.cpp:4373-4379`).
      if (isPreviewing) endCameraPreview?.();
      return;
    }
    // On every re-render, outside the activation gate, so a resize refits it.
    fitToCanvas(target, size);

    // Swap on a pick, on the one-shot deep-link seed, and onto a previewed camera that a
    // projection change remounted. A scene switch re-runs this with a stale path that may name
    // a camera in the new scene, before SceneChangeResetter clears it.
    const shouldActivate = pathChanged || !seedConsumedRef.current || isPreviewing;
    seedConsumedRef.current = true;
    if (shouldActivate && target !== camera) {
      set({ camera: target });
    }
  }, [previewedCameraPath, rootKey, target, camera, get, set, size, endCameraPreview]);

  return null;
}
