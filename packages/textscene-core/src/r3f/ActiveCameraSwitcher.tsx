/** Switches the 3D canvas between the editor camera and a previewed scene Camera3D. */
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { fitToAspect, fittedAspect, type CameraLike } from '../nodes/3d/camera3d/projectionFit.js';
import { EditorControlsHandle } from './EditorControlsHandle.js';

type SceneCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

/**
 * The mounted camera that Camera3D tagged with `path` in its userData, fitted to the
 * live canvas, or null. A node camera mounts at a placeholder 16/9 aspect.
 */
function sceneCameraAt(scene: THREE.Scene, path: string, size: RootState['size']): SceneCamera | null {
  let target: SceneCamera | null = null;
  scene.traverse((object) => {
    const cam = object as CameraLike;
    if (!target && (cam.isPerspectiveCamera || cam.isOrthographicCamera) && cam.userData.tscnPath === path) {
      target = object as SceneCamera;
    }
  });
  const found: SceneCamera | null = target;
  if (found && size.height > 0) {
    const aspect = size.width / size.height;
    if (fittedAspect(found) !== aspect) fitToAspect(found, aspect);
  }
  return found;
}

/**
 * Makes the Camera3D the user previews the render camera of the 3D canvas. With no
 * preview, the canvas draws through the editor camera at the pose it had before.
 */
export function ActiveCameraSwitcher() {
  const control = useOptionalViewportActions();
  const activeCameraPath = control?.activeCameraPath ?? null;
  const returnToFreeView = control?.returnToFreeView;
  const hierarchy = useOptionalHierarchy();
  // Re-run when the scene loads: a deep-linked (`?camera=`) path is set before
  // any Camera3D has mounted and tagged itself, so the first pass finds nothing.
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const set = useThree((s) => s.set);
  const controls = useThree((s) => s.controls);
  const size = useThree((s) => s.size);
  // Tells an intentional activation from an incidental effect re-run.
  const prevPathRef = useRef<string | null>(activeCameraPath);
  const seedConsumedRef = useRef(false);

  useEffect(() => {
    const pathChanged = prevPathRef.current !== activeCameraPath;
    prevPathRef.current = activeCameraPath;
    if (!activeCameraPath) {
      // Godot re-attaches its editor camera when a preview ends (`node_3d_editor_plugin.cpp:4486-4492`).
      if (controls instanceof EditorControlsHandle && camera !== controls.camera) {
        set({ camera: controls.camera });
      }
      return;
    }

    // It fits the aspect on every re-render, outside the activation gate.
    const target = sceneCameraAt(scene, activeCameraPath, size);
    if (!target) return;

    // Swap only on a pick or the one-shot deep-link seed. A scene switch re-runs
    // this with a stale path that may name a camera in the new scene, before
    // SceneChangeResetter clears it.
    const shouldActivate = pathChanged || !seedConsumedRef.current;
    seedConsumedRef.current = true;
    if (shouldActivate && target !== camera) {
      set({ camera: target });
    }
  }, [activeCameraPath, rootKey, scene, camera, controls, set, size]);

  // A previewed camera that left the scene was remounted, as a projection change
  // does, or removed. Godot ends the preview of a removed one (`node_3d_editor_plugin.cpp:4373-4379`).
  useFrame(() => {
    const isOrphanedPreview =
      activeCameraPath !== null && camera.parent === null && camera.userData.tscnPath === activeCameraPath;
    if (!isOrphanedPreview) return;
    const remounted = sceneCameraAt(scene, activeCameraPath, size);
    if (remounted) set({ camera: remounted });
    else returnToFreeView?.();
  });

  return null;
}
