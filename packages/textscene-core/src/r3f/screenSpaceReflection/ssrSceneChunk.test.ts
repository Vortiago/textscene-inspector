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
      'reflectedLight.indirectSpecular = reflectedLight.indirectSpecular * ( 1.0 - godotSsr.a ) + godotSsr.rgb * godotIndirectSpecularWeight( material );'
    );
  });

  it("lays it after Godot's occlusion of a reflection, which never dims it", () => {
    const ao = chunks.aomap_fragment;

    expect(ao.indexOf('godotSsr.a')).toBeGreaterThan(ao.indexOf('*= godotSpecularOcclusion;'));
  });

  it('writes the normal and the roughness in place of the colour while the prepass draws', () => {
    installGodotScreenSpaceReflection();
    const fragment = THREE.ShaderLib.physical.fragmentShader;
    const output = fragment.indexOf(
      'gl_FragColor = vec4( godotEncodeNormal( normal ) * 0.5 + 0.5, material.godotRoughness * ( 127.0 / 255.0 ) );'
    );

    expect(output).toBeGreaterThan(fragment.indexOf('#include <lights_physical_fragment>'));
    expect(output).toBeLessThan(fragment.indexOf('#include <lights_fragment_begin>'));
  });

  it('writes the prepass output in the standard program as in the physical one', () => {
    installGodotScreenSpaceReflection();

    expect(THREE.ShaderLib.standard.fragmentShader).toContain('godotEncodeNormal( normal )');
  });

  it('gives every lit material the shared reflection and its state', () => {
    installGodotScreenSpaceReflection();

    expect(Object.keys(THREE.ShaderLib.physical.uniforms)).toEqual(
      expect.arrayContaining([SSR_UNIFORM.reflection, SSR_UNIFORM.state, SSR_UNIFORM.bestFitNormals])
    );
  });

  it('writes an unshaded surface its face normal and roughness 1, after its alpha cut', () => {
    installGodotScreenSpaceReflection();
    const fragment = THREE.ShaderLib.basic.fragmentShader;
    const output = fragment.indexOf('godotEncodeNormal( godotFaceNormal ) * 0.5 + 0.5, 127.0 / 255.0 )');

    expect(output).toBeGreaterThan(fragment.indexOf('#include <alphahash_fragment>'));
    expect(THREE.ShaderLib.basic.vertexShader).toContain('vGodotViewPosition = - mvPosition.xyz;');
  });

  it('gives the unshaded material the prepass state and the best-fit table it encodes with', () => {
    installGodotScreenSpaceReflection();

    expect(Object.keys(THREE.ShaderLib.basic.uniforms)).toEqual(
      expect.arrayContaining([SSR_UNIFORM.state, SSR_UNIFORM.bestFitNormals])
    );
  });
});
