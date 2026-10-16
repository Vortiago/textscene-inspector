/** Switches the 3D canvas between the default orbit camera and a scene Camera3D. */
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { fitToAspect, fittedAspect, type CameraLike } from '../nodes/3d/camera3d/projectionFit.js';

/**
 * Makes the Camera3D the user picks with "Use This Camera" the active render camera of the 3D
 * canvas, and "Reset" returns to the default orbit camera.
 */
export function ActiveCameraSwitcher() {
  const control = useOptionalViewportActions();
  const activeCameraPath = control?.activeCameraPath ?? null;
  const hierarchy = useOptionalHierarchy();
  // Re-run when the scene loads: a deep-linked (`?camera=`) path is set before
  // any Camera3D has mounted and tagged itself, so the first pass finds nothing.
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);
  // Tells an intentional activation from an incidental effect re-run.
  const prevPathRef = useRef<string | null>(activeCameraPath);
  const seedConsumedRef = useRef(false);

  useEffect(() => {
    const pathChanged = prevPathRef.current !== activeCameraPath;
    prevPathRef.current = activeCameraPath;
    if (!activeCameraPath) {
      return;
    }

    // Camera3D tags its camera's userData with its node path.
    const cameras: (THREE.PerspectiveCamera | THREE.OrthographicCamera)[] = [];
    scene.traverse((object) => {
      const cam = object as CameraLike;
      if (cam.isPerspectiveCamera || cam.isOrthographicCamera) {
        cameras.push(object as THREE.PerspectiveCamera | THREE.OrthographicCamera);
      }
    });
    const target =
      cameras.find((c) => (c.userData as { tscnPath?: string }).tscnPath === activeCameraPath) ?? null;
    if (!target) return;
    // Matched to the live canvas: a node camera mounts at a placeholder 16/9
    // aspect. It runs on every re-render, outside the activation gate.
    if (size.height > 0) {
      const aspect = size.width / size.height;
      if (fittedAspect(target) !== aspect) fitToAspect(target, aspect);
    }

    // Swap only on a pick or the one-shot deep-link seed. A scene switch re-runs
    // this with a stale path that may name a camera in the new scene, before
    // SceneChangeResetter clears it. The gate also keeps a `camera` re-run from
    // undoing a Reset Camera.
    const shouldActivate = pathChanged || !seedConsumedRef.current;
    seedConsumedRef.current = true;
    if (shouldActivate && target !== camera) {
      set({ camera: target });
    }
  }, [activeCameraPath, rootKey, scene, camera, set, size]);

  return null;
}
