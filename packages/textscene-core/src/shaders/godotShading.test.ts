/** The install of Godot's shading on a renderer: its handler, its light nodes and its lit materials. */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DiffuseMode } from '../godot/rendering/materials/diffuseMode.js';
import { SpecularMode } from '../godot/rendering/materials/specularMode.js';
import { installGodotShading } from './godotShading.js';
import { litPipelineOf } from './litPipeline.js';
import { GodotSunLightNode } from './sunLightNode.js';

/** A renderer that takes a handler: the install needs no GL context. */
function renderer(): THREE.WebGLRenderer {
  return { setNodesHandler: vi.fn() } as unknown as THREE.WebGLRenderer;
}

/** The light node class three resolves for `light` (r187 `LightsNode.js:263`). */
function lightNodeOf(light: THREE.Light): unknown {
  return (light as unknown as { _lightNode?: unknown })._lightNode;
}

const DEFAULT_PROGRAM = {
  diffuseMode: DiffuseMode.DIFFUSE_BURLEY,
  specularMode: SpecularMode.SPECULAR_SCHLICK_GGX,
  hasClearcoat: false,
};

describe('installGodotShading', () => {
  it('shades every directional light through the sun node', () => {
    installGodotShading(renderer());

    expect(lightNodeOf(new THREE.DirectionalLight())).toBe(GodotSunLightNode);
  });

  it('shades a light class the caller names as a sun through the sun node', () => {
    class StandIn extends THREE.Light {}
    installGodotShading(renderer(), { sunLights: [StandIn] });

    expect(lightNodeOf(new StandIn())).toBe(GodotSunLightNode);
  });

  it('answers a second call for the same renderer with the same shading', () => {
    const target = renderer();

    expect(installGodotShading(target)).toBe(installGodotShading(target));
  });

  it('gives each renderer a pipeline of its own', () => {
    const first = installGodotShading(renderer()).surfaceMaterial(DEFAULT_PROGRAM);
    const second = installGodotShading(renderer()).surfaceMaterial(DEFAULT_PROGRAM);

    expect(litPipelineOf(first)).not.toBe(litPipelineOf(second));
  });

  it('gives renderers that share inputs one shading', () => {
    const inputs = {};

    expect(installGodotShading(renderer(), { inputs })).toBe(installGodotShading(renderer(), { inputs }));
  });

  it('makes lit materials that read the shading’s inputs', () => {
    const shading = installGodotShading(renderer());
    const material = shading.surfaceMaterial(DEFAULT_PROGRAM);

    expect(litPipelineOf(material)?.inputs).toBe(shading.inputs);
  });
});
