import type * as THREE from 'three';
import { memoisedImport } from '../../resources/memoisedImport';
import { useLazyModuleState } from '../../resources/useLazyModule';
import { useNodesHandler } from '../canvasRenderer/canvasNodesHandler';

/** Imported by the first sky only: it holds the shader parser, which would double the first paint. */
const loadSkyTranspiler = memoisedImport(() => import('../../resources/sky/shaderSky'));

export type SkyTranspiler = Awaited<ReturnType<typeof loadSkyTranspiler>>;

/** What a sky draws with, each loaded on demand. */
export interface SkyTranslator {
  /** The transpiler once loaded, null before. */
  readonly transpiler: SkyTranspiler | null;
  /** Whether the renderer can draw the transpiled sky. */
  readonly isReady: boolean;
  /** Why the sky draws nothing, as the node details show it, or null. */
  readonly loadFailure: string | null;
}

const LOAD_FAILURE =
  'The previewer could not load its sky shader translator, so it draws no sky. Reload to try again.';

/** The transpiler and the nodes handler a sky draws with. */
export function useSkyTranslator(gl: THREE.WebGLRenderer): SkyTranslator {
  const transpiler = useLazyModuleState(loadSkyTranspiler, true);
  const nodesHandler = useNodesHandler(gl, true);
  return {
    transpiler: typeof transpiler === 'object' && transpiler !== null ? transpiler.module : null,
    isReady: nodesHandler === 'ready',
    loadFailure: transpiler === 'failed' || nodesHandler === 'failed' ? LOAD_FAILURE : null,
  };
}
