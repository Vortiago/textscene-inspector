/**
 * Clears all selection-derived state when `sceneGraph` changes between two
 * non-null values. Without it the highlight renders against an unmounted
 * Object3D. The first scene clears nothing. It calls `clearAll()`, so it
 * lives inside `<SelectionProvider>`.
 */
import { useEffect, useRef } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';

export function SceneChangeResetter({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { clearAll } = useSelection();
  const returnToFreeView = useOptionalCameraControl()?.returnToFreeView;
  const prevSceneGraphRef = useRef<SceneGraph | null>(sceneGraph);

  useEffect(() => {
    const prev = prevSceneGraphRef.current;
    if (prev !== null && sceneGraph !== null && prev !== sceneGraph) {
      clearAll();
      // The old scene's Camera3D is gone. Free orbit lets CameraFit, gated on
      // `activeCameraPath === null`, frame the new scene.
      returnToFreeView?.();
    }
    prevSceneGraphRef.current = sceneGraph;
  }, [sceneGraph, clearAll, returnToFreeView]);

  return null;
}
