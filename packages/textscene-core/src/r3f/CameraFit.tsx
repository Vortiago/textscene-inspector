/** Frames the 3D scene on load when the viewport asks for it. */
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type * as THREE from 'three';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { useViewStatus } from './viewStatus/ViewStatusContext.js';
import { isDrawingPreview } from './EditorControlsHandle.js';
import { useViewportMode } from './contexts/ViewportModeContext.js';
import { frameSceneBounds, type OrbitLike } from './frameSceneBounds.js';

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

  const status = useViewStatus();

  useEffect(() => {
    if (!frameOnOpen || !hasScene) return undefined;

    // The settle-fit stands down when the camera has left this position, so
    // the user's own orbit wins.
    let lastSet: THREE.Vector3 | null = null;
    const fit = () => {
      const state = get();
      // A preview draws through the authored Camera3D, which framing would move.
      if (isDrawingPreview(state)) return;
      frameSceneBounds(state.scene, state.camera, state.controls as OrbitLike | null);
      lastSet = state.camera.position.clone();
    };

    // The visual harness clicks for a `-selected` capture only after the last timer.
    const timers = [150, 500, 1100].map((delay) => setTimeout(fit, delay));

    // Fits on each settle of the view, not once: the scene can settle before an instanced `.glb` loads.
    let wasSettled = false;
    const fitOnSettle = () => {
      const isSettled = status?.settled() != null;
      if (isSettled && !wasSettled && !(lastSet && !get().camera.position.equals(lastSet))) fit();
      wasSettled = isSettled;
    };
    const unsubscribe = status?.subscribe(fitOnSettle);

    return () => {
      timers.forEach(clearTimeout);
      unsubscribe?.();
    };
  }, [rootKey, hasScene, frameOnOpen, get, status]);

  return null;
}
