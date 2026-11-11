/**
 * What a fiber `<Canvas>` needs to draw on the spike's renderer path: its `gl` prop and its
 * `onCreated`. The two `WebGPURenderer` paths mount through fiber's asynchronous `gl` factory.
 */

import type { CanvasProps, RootState } from '@react-three/fiber';
import type * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { installShaderPatches } from '../shaderPatch/installShaderPatches.js';
import { installNodesHandler } from './nodesHandler.js';
import { spikeRenderer } from './spikeRenderer.js';

/** `localClippingEnabled` has no `WebGPURenderer` counterpart: it clips by every material's planes. */
type ClassicParameters = Pick<THREE.WebGLRendererParameters, 'alpha' | 'antialias'> & {
  localClippingEnabled: boolean;
};

/** `classic` as the canvas's `gl` prop on the two `WebGLRenderer` paths, else a factory. */
export function spikeGl(classic: ClassicParameters): CanvasProps['gl'] {
  const path = spikeRenderer();
  if (path === 'classic' || path === 'handler') return classic;
  return async ({ canvas }) => {
    const renderer = new WebGPURenderer({
      canvas: canvas as HTMLCanvasElement,
      alpha: classic.alpha,
      antialias: classic.antialias,
      forceWebGL: path === 'webgpu-webgl2',
    });
    await renderer.init();
    // fiber types its renderer as the one it creates by default.
    return renderer as unknown as THREE.WebGLRenderer;
  };
}

/** Installs the shader patches, and three's nodes handler on the `handler` path. */
export function prepareSpikeRenderer({ gl }: RootState): void {
  installShaderPatches();
  if (spikeRenderer() === 'handler') installNodesHandler(gl);
}
