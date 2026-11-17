import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { memoisedImport } from '../../resources/memoisedImport.js';
import { useLazyModuleState } from '../../resources/useLazyModule.js';

/** Imported by the first node material only, which keeps three's TSL off the first paint. */
const loadNodesHandler = memoisedImport(() => import('../../shaders/nodesHandler.js'));

/** Whether `gl` can draw a node material yet, or `failed` when the handler did not load. */
export type NodesHandlerState = 'ready' | 'loading' | 'failed';

/** The handler writes linear for the compositor (ADR-0061). A caller that draws no node material is ready. */
export function useNodesHandler(gl: THREE.WebGLRenderer, isNeeded: boolean): NodesHandlerState {
  const loaded = useLazyModuleState(loadNodesHandler, isNeeded);
  const [handled, setHandled] = useState<THREE.WebGLRenderer | null>(null);
  const module = typeof loaded === 'object' && loaded !== null ? loaded.module : null;
  useEffect(() => {
    if (!module || handled === gl) return;
    module.installNodesHandler(gl, 'linear');
    setHandled(gl);
  }, [gl, module, handled]);
  if (!isNeeded || handled === gl) return 'ready';
  return loaded === 'failed' ? 'failed' : 'loading';
}
