import type * as THREE from 'three';
import { memoisedImport } from '../../resources/memoisedImport';
import { useLazyModuleState } from '../../resources/useLazyModule';
import { useNodesHandler } from '../canvasRenderer/canvasNodesHandler';

/** Imported by the first shader sky only: it holds the shader parser, which would double the first paint. */
const loadSkyTranspiler = memoisedImport(() => import('../../resources/sky/shaderSky'));

export type SkyTranspiler = Awaited<ReturnType<typeof loadSkyTranspiler>>;

/** What a shader sky draws with, each loaded on demand. */
export interface SkyTranslator {
  /** The transpiler once loaded, null for a built-in sky. */
  readonly transpiler: SkyTranspiler | null;
  /** Whether the renderer can draw the transpiled sky: always for a built-in sky. */
  readonly isReady: boolean;
  /** Why a shader sky draws nothing, as the node details show it, or null. */
  readonly loadFailure: string | null;
}

const LOAD_FAILURE =
  'The previewer could not load its sky shader translator, so it draws no sky. Reload to try again.';

/** The transpiler and the nodes handler for a sky that needs them. */
export function useSkyTranslator(gl: THREE.WebGLRenderer, isNeeded: boolean): SkyTranslator {
  const transpiler = useLazyModuleState(loadSkyTranspiler, isNeeded);
  const nodesHandler = useNodesHandler(gl, isNeeded);
  return {
    transpiler: typeof transpiler === 'object' && transpiler !== null ? transpiler.module : null,
    isReady: nodesHandler === 'ready',
    loadFailure: transpiler === 'failed' || nodesHandler === 'failed' ? LOAD_FAILURE : null,
  };
}
