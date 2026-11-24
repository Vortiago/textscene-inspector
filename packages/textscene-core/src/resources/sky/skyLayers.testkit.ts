import * as THREE from 'three';
import { cubeRadiance, type SkyLayers } from './skyLayers';
import { OctmapRadiance, type OctmapSky, type RadianceFilterSettings } from './octmapRadiance';
import type { SkyBake } from './types';

/** Godot's sky layers of the cube `radiance`, baked through the real bake. The caller frees them. */
export function bakeSkyLayers(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  bake: SkyBake,
  filters?: RadianceFilterSettings
): SkyLayers {
  const cubeSky: OctmapSky = {
    draw: (renderer, octmap, layout) => cubeRadiance(renderer, radiance)(octmap, layout),
    dispose: () => {},
  };
  return new OctmapRadiance(gl, bake, cubeSky, 1, filters).releaseLayers();
}
