/**
 * The reflection rides three's lit chunks. A three release that rewrites an anchor fails here, not
 * silently in a capture.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotScreenSpaceReflection } from './ssrSceneChunk';
import { SSR_UNIFORM } from './ssrUniforms';
import { scalarGlslFunction } from '../testing/glslScalar';
import { installedShaderChunks, restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

restoreShaderGlobalsAfterEach();

const chunks = installedShaderChunks();
const roughnessFade = scalarGlslFunction(chunks.lights_physical_pars_fragment, 'godotSsrRoughnessFade');

describe('godotSsrRoughnessFade', () => {
  it('keeps the whole reflection up to roughness 0.6', () => {
    expect([roughnessFade(0), roughnessFade(0.5), roughnessFade(0.6)]).toEqual([1, 1, 1]);
  });

  it('fades the reflection out by a smoothstep from 0.6 to 0.7 (scene_forward_clustered.glsl:2204)', () => {
    expect(roughnessFade(0.65)).toBeCloseTo(0.5, 12);
    expect(roughnessFade(0.625)).toBeCloseTo(0.84375, 12);
  });

  it('keeps none of it from roughness 0.7, where the trace draws nothing (edge case)', () => {
    expect([roughnessFade(0.7), roughnessFade(1)]).toEqual([0, 0]);
  });
});

describe('installGodotScreenSpaceReflection', () => {
  it("lays the premultiplied reflection over the indirect specular, weighted as Godot's", () => {
    expect(chunks.aomap_fragment).toContain(
      'reflectedLight.indirectSpecular = reflectedLight.indirectSpecular * ( 1.0 - godotSsr.a ) + godotIndirectSpecular( godotSsr.rgb, material );'
    );
  });

  it("lays it after Godot's occlusion of a reflection, which never dims it", () => {
    const ao = chunks.aomap_fragment;

    expect(ao.indexOf('godotSsr.a')).toBeGreaterThan(ao.indexOf('*= godotSpecularOcclusion;'));
  });

  it('gives every lit material the shared reflection', () => {
    installGodotScreenSpaceReflection();

    expect(Object.keys(THREE.ShaderLib.physical.uniforms)).toContain(SSR_UNIFORM.reflection);
  });
});
