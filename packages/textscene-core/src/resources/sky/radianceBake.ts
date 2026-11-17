import * as THREE from 'three';
import type { SkyBake } from './types';
import { bakeSkyLayers, type SkyLayers } from './skyLayers';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState';

/** Each doubling costs four times the bake. Metal balls under a 512 sky stay within 0.07/255 of Godot's. */
const LARGEST_RADIANCE_SIZE = 256;

/** The cube camera sits at the origin, so each face samples the directions Godot's `EYEDIR` covers. */
export function bakeRadiance(
  gl: THREE.WebGLRenderer,
  skyScene: THREE.Scene,
  bake: SkyBake,
  debanding: number,
  sampling?: ProjectSampling
): SkyLayers {
  const capped = cappedBake(bake);
  const radianceTarget = new THREE.WebGLCubeRenderTarget(capped.radianceSize, { type: THREE.HalfFloatType });
  try {
    new THREE.CubeCamera(0.1, 10, radianceTarget).update(gl, skyScene);
    return bakeSkyLayers(gl, radianceTarget.texture, capped, debanding, sampling);
  } finally {
    // The cube serves the layers once.
    radianceTarget.dispose();
  }
}

/** The bake the previewer runs: an importance-sampled sky above `LARGEST_RADIANCE_SIZE` bakes at it. */
export function cappedBake(bake: SkyBake): SkyBake {
  if (bake.radianceFilter === 'fast') return bake;
  return {
    radianceFilter: 'importance-sample',
    radianceSize: Math.min(bake.radianceSize, LARGEST_RADIANCE_SIZE),
  };
}
