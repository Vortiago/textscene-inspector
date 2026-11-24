import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { ShaderSkyOctmap } from './shaderSkyOctmap';
import { transpileSky } from '../../shaders/sky/transpileSky.js';
import { DEFAULT_SKY } from '../../shaders/sky/defaultSky.testkit';
import { recordingRenderer } from '../liveTargets.testkit';

const LAYOUT = { size: 8, borderSize: 1 } as Parameters<ShaderSkyOctmap['draw']>[2];

function drawnUniforms(energy: number) {
  const sky = transpileSky(DEFAULT_SKY, { pass: 'octmap' });
  const octmap = new ShaderSkyOctmap(sky, [], []);
  const { gl } = recordingRenderer();
  octmap.draw(gl, new THREE.WebGLRenderTarget(8, 8), LAYOUT, { x: 0, y: 0, z: 0 }, energy);
  return (name: string) => (sky.uniforms.get(name) as UniformNode<number>).value;
}

describe('ShaderSkyOctmap', () => {
  // Godot adds the debanding noise after the energy (`render_forward_clustered.cpp:2045`, `sky.glsl:314`).
  it('draws at the energy with a luminance of its inverse, so the noise is not scaled by the energy', () => {
    const uniform = drawnUniforms(4);
    expect(uniform('params.brightness_multiplier')).toBe(4);
    expect(uniform('params.luminance_multiplier')).toBe(0.25);
  });

  it('draws at 1 for an energy of 0, which a surface reads as black (edge case)', () => {
    const uniform = drawnUniforms(0);
    expect(uniform('params.brightness_multiplier')).toBe(1);
    expect(uniform('params.luminance_multiplier')).toBe(1);
  });
});
