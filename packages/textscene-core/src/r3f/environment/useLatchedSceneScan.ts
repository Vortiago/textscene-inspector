/**
 * A scene predicate that latches once it holds, for the compositor's mount decision.
 */

import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useOptionalHierarchy } from '../contexts/HierarchyContext';

/**
 * Re-runs a scene predicate every frame until it holds, then latches. Content arrives whenever its
 * load ends: a GLB, an instanced sub-scene, or a texture that makes a material emissive. The latch
 * matters because mounting the composer flips `gl.toneMapping`, which recompiles every tone-mapped
 * material. A null predicate skips the scan.
 */
export function useLatchedSceneScan(scan: ((scene: THREE.Object3D) => boolean) | null): boolean {
  const scene = useThree((s) => s.scene);
  const hierarchy = useOptionalHierarchy();
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const [found, setFound] = useState(false);
  /** Written by the frame scan when it latches. Cleared when the scene or the predicate changes. */
  const latched = useRef(false);

  useEffect(() => {
    // A different scene must not inherit the previous one's latch.
    latched.current = false;
    setFound(false);
  }, [scene, rootKey, scan]);

  useFrame(() => {
    if (latched.current || scan === null || !scan(scene)) return;
    latched.current = true;
    setFound(true);
  });

  return found;
}
