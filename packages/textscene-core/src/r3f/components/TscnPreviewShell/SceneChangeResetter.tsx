/**
 * Clears all selection-derived state when `sceneGraph` changes between two
 * non-null values. Without it the highlight renders against an unmounted
 * Object3D. The first scene clears nothing. It calls `clearAll()`, so it
 * lives inside `<SelectionProvider>`.
 */
import { useEffect, useRef } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { useOptionalViewportActions } from '../../contexts/ViewportActionsContext.js';

export function SceneChangeResetter({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { clearAll } = useSelection();
  const endCameraPreview = useOptionalViewportActions()?.endCameraPreview;
  const prevSceneGraphRef = useRef<SceneGraph | null>(sceneGraph);

  useEffect(() => {
    const prev = prevSceneGraphRef.current;
    if (prev !== null && sceneGraph !== null && prev !== sceneGraph) {
      clearAll();
      // The old scene's Camera3D is gone. Ending the preview lets CameraFit, gated on
      // `previewedCameraPath === null`, frame the new scene.
      endCameraPreview?.();
    }
    prevSceneGraphRef.current = sceneGraph;
  }, [sceneGraph, clearAll, endCameraPreview]);

  return null;
}
