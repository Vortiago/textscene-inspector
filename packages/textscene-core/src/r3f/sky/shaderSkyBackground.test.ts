import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { afterEach, describe, expect, it } from 'vitest';
import { ShaderSkyBackground } from './shaderSkyBackground';
import { transpileSky } from '../../shaders/sky/transpileSky';
import { DEFAULT_SKY } from '../../shaders/sky/defaultSky.testkit';
import { fogUniforms } from '../fog/fogUniforms';

const renderer = {} as THREE.WebGLRenderer;

/** The sky's uniforms after one render behind the scene. */
function renderedSky() {
  const sky = transpileSky(DEFAULT_SKY);
  new ShaderSkyBackground(sky, []).onBeforeRender(renderer, new THREE.Scene(), new THREE.PerspectiveCamera());
  return { sky, uniform: (name: string) => (sky.uniforms.get(name) as UniformNode<unknown>).value };
}

afterEach(() => fogUniforms.volumeLookup.fill(0));

describe('ShaderSkyBackground', () => {
  it('reads no volumetric fog while the fog pass draws none', () => {
    expect(renderedSky().uniform('sky_scene_data.volumetric_fog_enabled')).toBe(false);
  });

  it('reads the volumetric fog the fog pass wrote for the render', () => {
    fogUniforms.volumeLookup.set([0.02, 0.5, 0.75, 1]);
    const { sky, uniform } = renderedSky();
    const written = ['inv_length', 'detail_spread', 'sky_affect'].map((name) =>
      uniform(`sky_scene_data.volumetric_fog_${name}`)
    );
    expect([...written, uniform('sky_scene_data.fog_use_legacy_blending')]).toEqual([
      expect.closeTo(0.02, 6),
      0.5,
      0.75,
      true,
    ]);
    expect(sky.textures.get('volumetric_fog_texture')!.value).toBe(fogUniforms.volume);
  });
});
