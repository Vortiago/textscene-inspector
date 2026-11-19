/** Frames the 3D scene on load when the viewport asks for it. */
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type * as THREE from 'three';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useViewStatus } from './viewStatus/ViewStatusContext.js';
import { isDrawingPreview } from './EditorControlsHandle.js';
import { useViewportMode } from './contexts/ViewportModeContext.js';
import { frameSceneBounds, type OrbitLike } from './frameSceneBounds.js';

/** An orthographic zoom moves no pose. */
function zoomOf(camera: THREE.Camera): number {
  return (camera as THREE.PerspectiveCamera | THREE.OrthographicCamera).zoom ?? 1;
}

/**
 * Frames the scene on load when `frameOnOpen` is on, with no camera preview. It is
 * off by default, since Godot's editor opens at a fixed orbit and leaves framing
 * to F. A short settle window catches async content without fighting the orbit.
 * A selection never moves the camera: FrameSelectedShortcut re-frames on request.
 */
export function CameraFit() {
  const hierarchy = useOptionalHierarchy();
  const { frameOnOpen } = useViewportMode();
  const get = useThree((s) => s.get);
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const hasScene = !!hierarchy?.sceneGraph;
  const scene = hierarchy?.scene;

  const status = useViewStatus();

  useEffect(() => {
    if (!frameOnOpen || !hasScene) return undefined;

    // A settle-fit stands down once the camera has left this pose, so the user's own orbit, pan or zoom wins.
    let lastSet: { pose: THREE.Matrix4; zoom: number } | null = null;
    const fit = () => {
      const state = get();
      // A preview draws through the authored Camera3D, which framing would move.
      if (isDrawingPreview(state)) return;
      frameSceneBounds(state.scene, state.camera, state.controls as OrbitLike | null);
      state.camera.updateMatrixWorld();
      lastSet = { pose: state.camera.matrixWorld.clone(), zoom: zoomOf(state.camera) };
    };
    const hasCameraMoved = () => {
      const { camera } = get();
      camera.updateMatrixWorld();
      return (
        lastSet !== null && (!camera.matrixWorld.equals(lastSet.pose) || zoomOf(camera) !== lastSet.zoom)
      );
    };

    // The visual harness clicks for a `-selected` capture only after the last timer.
    const timers = [150, 500, 1100].map((delay) => setTimeout(fit, delay));

    // The opened text fits on each settle, as one can precede an instanced `.glb` load. A write never does.
    let openedRevision: number | null = null;
    let wasSettled = false;
    const fitOnSettle = () => {
      const isSettled = status?.settled() != null;
      if (isSettled && !wasSettled) {
        const revision = scene?.revision() ?? 0;
        openedRevision ??= revision;
        // After the frame: a fit inside it leaves `environment-ssao` settled on another picture.
        if (revision === openedRevision && !hasCameraMoved()) queueMicrotask(fit);
      }
      wasSettled = isSettled;
    };
    const unsubscribe = status?.subscribe(fitOnSettle);

    return () => {
      timers.forEach(clearTimeout);
      unsubscribe?.();
    };
  }, [rootKey, hasScene, frameOnOpen, get, status, scene]);

  return null;
}
