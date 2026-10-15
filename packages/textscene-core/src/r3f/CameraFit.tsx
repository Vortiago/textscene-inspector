/** Frames the 3D scene on load when the viewport asks for it. */
import { useThree } from '@react-three/fiber';
import { useContext, useEffect } from 'react';
import type * as THREE from 'three';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { ResourceLoaderContext } from '../resources/ResourceLoaderContext.js';
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { useViewportMode } from './contexts/ViewportModeContext.js';
import { frameSceneBounds, type OrbitLike } from './frameSceneBounds.js';

/**
 * Frames the scene on load when `frameOnOpen` is on, in free orbit only. It is
 * off by default, since Godot's editor opens at a fixed orbit and leaves framing
 * to F. A short settle window catches async content without fighting the orbit.
 * A selection never moves the camera: FrameSelectedShortcut re-frames on request.
 */
export function CameraFit() {
  const hierarchy = useOptionalHierarchy();
  const control = useOptionalViewportActions();
  const { frameOnOpen } = useViewportMode();
  const get = useThree((s) => s.get);
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const hasScene = !!hierarchy?.sceneGraph;
  const activeCameraPath = control?.activeCameraPath ?? null;

  const loader = useContext(ResourceLoaderContext);

  useEffect(() => {
    if (!frameOnOpen || !hasScene || activeCameraPath) return undefined;

    // The settle-fit stands down when the camera has left this position, so
    // the user's own orbit wins.
    let lastSet: THREE.Vector3 | null = null;
    const fit = () => {
      const state = get();
      frameSceneBounds(state.scene, state.camera, state.controls as OrbitLike | null);
      lastSet = state.camera.position.clone();
    };

    // The visual harness clicks for a `-selected` capture only after the last timer.
    const timers = [150, 500, 1100].map((delay) => setTimeout(fit, delay));

    // The timers guess when async content has arrived. The loader knows, so a
    // fit each time nothing is pending frames large external meshes whole. Each
    // time, not once: the count touches zero before an instanced `.glb` starts
    // its load. The release runs in the commit that mounts the loaded mesh.
    const unsubscribe = loader?.subscribePending(() => {
      if (loader.pendingResourceCount > 0) return;
      if (lastSet && !get().camera.position.equals(lastSet)) return;
      fit();
    });

    return () => {
      timers.forEach(clearTimeout);
      unsubscribe?.();
    };
  }, [rootKey, hasScene, activeCameraPath, frameOnOpen, get, loader]);

  return null;
}
