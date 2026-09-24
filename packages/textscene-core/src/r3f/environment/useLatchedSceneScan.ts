/**
 * A scene predicate that latches once it holds, for the compositor's mount decision.
 */

import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useOptionalHierarchy } from '../contexts/HierarchyContext';
import { useResourceLoader } from '../../resources/useResource';

/**
 * Frames the scan keeps running after the loader settles. A load's consumers commit within a
 * render or two of its last event, so ten frames cover them with room to spare.
 */
export const SCAN_FRAMES_AFTER_SETTLE = 10;

/**
 * Re-runs a scene predicate every frame while the scene loads and for a few frames after, then
 * stops. Loaded content (a texture that makes a material emissive, a GLB, a Label3D's glyphs)
 * counts. An overlay a later click adds does not, so selecting a node never switches the pipeline.
 * It latches because mounting the composer flips `gl.toneMapping`, which recompiles every
 * tone-mapped material. A null predicate skips the scan.
 */
export function useLatchedSceneScan(scan: ((scene: THREE.Object3D) => boolean) | null): boolean {
  const scene = useThree((s) => s.scene);
  const loader = useResourceLoader();
  const hierarchy = useOptionalHierarchy();
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const [found, setFound] = useState(false);
  /** Written by the frame scan when it latches. Cleared when the scene or the predicate changes. */
  const latched = useRef(false);
  /** Frames left to scan. Infinite while a load is pending, reset to the tail when it settles. */
  const framesLeft = useRef(SCAN_FRAMES_AFTER_SETTLE);

  useEffect(() => {
    // A different scene must not inherit the previous one's latch.
    latched.current = false;
    setFound(false);
    const onPendingChange = () => {
      const pending = (loader?.pendingResourceCount ?? 0) > 0;
      framesLeft.current = pending ? Infinity : SCAN_FRAMES_AFTER_SETTLE;
    };
    onPendingChange();
    const unsubscribe = loader?.subscribePending(onPendingChange);
    return () => {
      unsubscribe?.();
    };
  }, [scene, rootKey, scan, loader]);

  useFrame(() => {
    if (latched.current || scan === null || framesLeft.current <= 0) return;
    framesLeft.current -= 1;
    if (!scan(scene)) return;
    latched.current = true;
    setFound(true);
  });

  return found;
}
