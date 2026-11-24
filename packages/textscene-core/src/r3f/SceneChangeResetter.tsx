import { useEffect, useRef } from 'react';
import type { SceneGraph } from '../core/SceneGraph.js';
import { useSelection } from './contexts/SelectionContext.js';

interface SceneChangeResetterProps {
  sceneGraph: SceneGraph | null;
  /** Clears what a host keeps of the old scene, after the view's own state. */
  onNewScene?: () => void;
}

/** A new scene clears the selection, or the highlight draws a removed node. The first clears nothing. */
export function SceneChangeResetter({ sceneGraph, onNewScene }: SceneChangeResetterProps) {
  const { clearAll } = useSelection();
  const prevSceneGraphRef = useRef<SceneGraph | null>(sceneGraph);

  useEffect(() => {
    const prev = prevSceneGraphRef.current;
    if (prev !== null && sceneGraph !== null && prev !== sceneGraph) {
      clearAll();
      onNewScene?.();
    }
    prevSceneGraphRef.current = sceneGraph;
  }, [sceneGraph, clearAll, onNewScene]);

  return null;
}
