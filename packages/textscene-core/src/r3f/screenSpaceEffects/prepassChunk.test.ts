/**
 * The normal-roughness prepass rides three's lit and unshaded chunks. A three release that rewrites
 * an anchor fails here, not silently in a capture.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installNormalRoughnessPrepass } from './prepassChunk';
import { SCREEN_SPACE_UNIFORM } from './screenSpaceState';
import { UNLIT_DEFAULT_ROUGHNESS } from './unshadedRoughness';
import { UNLIT_NORMAL_VARYING } from '../shaderPatch/unlitVaryings';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

restoreShaderGlobalsAfterEach();

describe('installNormalRoughnessPrepass', () => {
  it('writes the normal and the roughness in place of the colour while the prepass draws', () => {
    installNormalRoughnessPrepass();
    const fragment = THREE.ShaderLib.physical.fragmentShader;
    const output = fragment.indexOf(
      'gl_FragColor = godotNormalRoughness( normal, material.godotRoughness );'
    );

    expect(output).toBeGreaterThan(fragment.indexOf('#include <lights_physical_fragment>'));
    expect(output).toBeLessThan(fragment.indexOf('#include <lights_fragment_begin>'));
  });

  it('writes the prepass output in the standard program as in the physical one', () => {
    installNormalRoughnessPrepass();

    expect(THREE.ShaderLib.standard.fragmentShader).toContain(
      'godotNormalRoughness( normal, material.godotRoughness )'
    );
  });

  it("stores the roughness in Godot's static half, which every reader folds back", () => {
    installNormalRoughnessPrepass();

    expect(THREE.ShaderLib.basic.fragmentShader).toContain('roughness * ( 127.0 / 255.0 )');
  });

  it('writes an unshaded surface its interpolated normal, after its alpha cut and its roughness map read', () => {
    installNormalRoughnessPrepass();
    const fragment = THREE.ShaderLib.basic.fragmentShader;
    const output = fragment.indexOf(
      `godotNormalRoughness( ${UNLIT_NORMAL_VARYING} * godotUnlitFace, godotUnlitRoughness )`
    );

    expect(output).toBeGreaterThan(fragment.indexOf('#include <alphahash_fragment>'));
    expect(output).toBeGreaterThan(fragment.indexOf('#include <specularmap_fragment>'));
  });

  it("writes an unshaded surface Godot's default roughness, which its material's own replaces", () => {
    installNormalRoughnessPrepass();

    expect(THREE.ShaderLib.basic.fragmentShader).toContain(UNLIT_DEFAULT_ROUGHNESS);
  });

  it('gives the unshaded material the prepass state and the best-fit table it encodes with', () => {
    installNormalRoughnessPrepass();

    expect(Object.keys(THREE.ShaderLib.basic.uniforms)).toEqual(
      expect.arrayContaining([SCREEN_SPACE_UNIFORM.state, SCREEN_SPACE_UNIFORM.bestFitNormals])
    );
  });

  it('gives every lit material the prepass state and the best-fit table', () => {
    installNormalRoughnessPrepass();

    expect(Object.keys(THREE.ShaderLib.physical.uniforms)).toEqual(
      expect.arrayContaining([SCREEN_SPACE_UNIFORM.state, SCREEN_SPACE_UNIFORM.bestFitNormals])
    );
  });
});
