import * as THREE from 'three';
import { vi } from 'vitest';
import { cubeRadiance, type SkyLayers } from './skyLayers';
import { OctmapRadiance, type OctmapSky } from './octmapRadiance';
import type { SkyBake } from './types';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState';

/** The debanding scale of each radiance octmap `renderer` draws while `bake` runs. */
export function debandingDrawnBy(renderer: THREE.WebGLRenderer, bake: () => void): number[] {
  const drawn: number[] = [];
  const render = renderer.render.bind(renderer);
  // A cube camera renders a scene, which has no material.
  vi.spyOn(renderer, 'render').mockImplementation((object, camera) => {
    const uniforms = ((object as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms;
    if (uniforms?.['radiance']) drawn.push(uniforms['debanding']!.value as number);
    render(object, camera);
  });
  bake();
  return drawn;
}

/** Godot's sky layers of the cube `radiance`, baked through the real bake. The caller frees them. */
export function bakeSkyLayers(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  bake: SkyBake,
  debanding: number,
  sampling?: ProjectSampling
): SkyLayers {
  const cubeSky: OctmapSky = {
    draw: (renderer, octmap, layout) => cubeRadiance(renderer, radiance, debanding)(octmap, layout),
    dispose: () => {},
  };
  return new OctmapRadiance(gl, bake, cubeSky, sampling).releaseLayers();
}
