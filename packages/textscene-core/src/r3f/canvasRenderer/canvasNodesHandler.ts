import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { warn } from '../../logger.js';
import { memoisedImport } from '../../resources/memoisedImport.js';

/** Imported by the first node material only, which keeps three's TSL off the first paint. */
const loadNodesHandler = memoisedImport(() => import('../../shaders/nodesHandler.js'));

/** Whether `gl` can draw what the caller needs. The handler writes linear for the compositor (ADR-0061). */
export function useNodesHandlerReady(gl: THREE.WebGLRenderer, isNeeded: boolean): boolean {
  const [handled, setHandled] = useState<THREE.WebGLRenderer | null>(null);
  useEffect(() => {
    if (!isNeeded || handled === gl) return undefined;
    let isCurrent = true;
    loadNodesHandler().then(
      ({ installNodesHandler }) => {
        installNodesHandler(gl, 'linear');
        if (isCurrent) setHandled(gl);
      },
      (error: unknown) => warn('[Canvas] could not load the nodes handler', error)
    );
    return () => {
      isCurrent = false;
    };
  }, [gl, isNeeded, handled]);
  return !isNeeded || handled === gl;
}
