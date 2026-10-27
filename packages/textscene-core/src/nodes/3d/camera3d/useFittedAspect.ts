/**
 * The aspect a camera is fitted to, as state, for a gizmo that draws the camera's shape. A viewport
 * fits a camera through `fitToAspect`, which keeps the aspect on the camera and tells nobody. The
 * hook reads it between renders: a viewport that fits a camera for one pass restores it before
 * the frame ends, so a read in `useFrame` never sees the transient aspect.
 */
import { useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { DEFAULT_ASPECT, fittedAspect } from './projectionFit';

export function useFittedAspect(cameraRef: RefObject<THREE.Camera | null>): number {
  const [aspect, setAspect] = useState(() => fitOf(cameraRef.current));
  useFrame(() => {
    const fitted = fitOf(cameraRef.current);
    if (fitted !== aspect) setAspect(fitted);
  });
  return aspect;
}

/** A camera that is not yet mounted, or not yet fitted, has the aspect it will mount at. */
function fitOf(camera: THREE.Camera | null): number {
  return (camera && fittedAspect(camera)) ?? DEFAULT_ASPECT;
}
