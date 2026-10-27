/**
 * The aspect a camera is fitted to, as state, for a gizmo that draws the camera's shape. A viewport
 * that fits a camera for one pass restores it in the same task, so React batches both writes.
 */
import { useEffect, useState, type RefObject } from 'react';
import type * as THREE from 'three';
import { DEFAULT_ASPECT, fittedAspect, onLensFit } from './projectionFit';

/** A camera that is not yet fitted has the aspect it will mount at. */
function fitOf(camera: THREE.Camera | null): number {
  return (camera && fittedAspect(camera)) ?? DEFAULT_ASPECT;
}

export function useFittedAspect(cameraRef: RefObject<THREE.Camera | null>): number {
  const [aspect, setAspect] = useState(() => fitOf(cameraRef.current));
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return undefined;
    const sync = () => setAspect(fitOf(camera));
    // A fit between the render and this effect is not heard.
    sync();
    return onLensFit(camera, sync);
  }, [cameraRef]);
  return aspect;
}
