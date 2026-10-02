/**
 * The patch is checked against the installed three's chunks, so a release that rewrites a sun
 * shadow sampler fails here and not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SHADOW_ATLAS_EDITS,
  installDirectionalShadowAtlas,
  shadowAtlasChunks,
  type ShadowAtlasChunks,
} from './shadowAtlasChunk';
import { DIRECTIONAL_SHADOW_ATLAS_UNIFORM, directionalShadowAtlasDepth } from './shadowAtlas';
import { godotSplitShadowChunk } from './splitShadowChunk';
import { shadowFadeChunks, type ShadowFadeChunks } from './shadowFade';
import { warningsOf } from '../testing/logWarnings';

const PARS = 'shadowmap_pars_fragment';
const LIGHTS = 'lights_fragment_begin';
const SHADOW_MASK = 'shadowmask_pars_fragment';
const threeChunks: ShadowAtlasChunks = {
  [PARS]: THREE.ShaderChunk[PARS],
  [LIGHTS]: THREE.ShaderChunk[LIGHTS],
  [SHADOW_MASK]: THREE.ShaderChunk[SHADOW_MASK],
};
const LIT_SHADERS = ['lambert', 'phong', 'standard', 'physical', 'toon', 'shadow'] as const;

const occurrences = (text: string, part: string) => text.split(part).length - 1;

/** The split lookup and the fade on `chunks`. */
function splitAndFade(chunks: ShadowAtlasChunks): ShadowFadeChunks {
  return shadowFadeChunks({ [PARS]: godotSplitShadowChunk(chunks[PARS])!, [LIGHTS]: chunks[LIGHTS] })!;
}

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
  for (const shader of Object.values(THREE.ShaderLib))
    delete shader.uniforms[DIRECTIONAL_SHADOW_ATLAS_UNIFORM];
  delete (THREE.UniformsLib.lights as Record<string, THREE.IUniform>)[DIRECTIONAL_SHADOW_ATLAS_UNIFORM];
});

describe('shadowAtlasChunks', () => {
  it('finds each replaced text exactly once in the installed three', () => {
    for (const { chunk, three } of SHADOW_ATLAS_EDITS) expect(occurrences(threeChunks[chunk], three)).toBe(1);
  });

  it('replaces both of three’s per-shadow sun samplers with one atlas sampler', () => {
    const { [PARS]: pars } = shadowAtlasChunks(threeChunks)!;
    expect(pars).not.toContain('sunShadowMap');
    expect(pars).toContain(`uniform sampler2DShadow ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM};`);
    expect(pars).toContain(`uniform sampler2D ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM};`);
  });

  it('samples the atlas for every sun, in the lit materials and in ShadowMaterial', () => {
    const { [LIGHTS]: lights, [SHADOW_MASK]: shadowMask } = shadowAtlasChunks(threeChunks)!;
    for (const chunk of [lights, shadowMask]) {
      expect(chunk).not.toContain('sunShadowMap');
      expect(occurrences(chunk, `getSunShadow( ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM},`)).toBe(1);
    }
  });

  it('leaves every other shadow its own sampler (edge case)', () => {
    const { [PARS]: pars, [LIGHTS]: lights } = shadowAtlasChunks(threeChunks)!;
    expect(pars).toContain('uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];');
    expect(lights).toContain('getShadow( directionalShadowMap[ i ]');
    expect(lights).toContain('getShadow( spotShadowMap[ i ]');
  });

  it('composes with the split lookup and the fade in any order', () => {
    const atlasFirst = shadowAtlasChunks(threeChunks)!;
    const splitAndFadeFirst = splitAndFade(threeChunks);
    const atlasLast = shadowAtlasChunks({ ...threeChunks, ...splitAndFadeFirst })!;
    const fadeLast = splitAndFade(atlasFirst);
    expect(atlasLast[PARS]).toBe(fadeLast[PARS]);
    expect(atlasLast[LIGHTS]).toBe(fadeLast[LIGHTS]);
    expect(occurrences(atlasLast[LIGHTS], `mix( getSunShadow( ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM},`)).toBe(1);
  });

  it('is null for chunks without three’s sun samplers (error case)', () => {
    expect(shadowAtlasChunks({ ...threeChunks, [PARS]: 'void main() {}' })).toBeNull();
    expect(shadowAtlasChunks({ ...threeChunks, [LIGHTS]: 'void main() {}' })).toBeNull();
    expect(shadowAtlasChunks({ ...threeChunks, [SHADOW_MASK]: 'void main() {}' })).toBeNull();
  });
});

describe('installDirectionalShadowAtlas', () => {
  it('gives every lit built-in material the atlas uniform', () => {
    installDirectionalShadowAtlas();
    for (const name of LIT_SHADERS) {
      expect(THREE.ShaderLib[name]!.uniforms[DIRECTIONAL_SHADOW_ATLAS_UNIFORM]!.value).toBe(
        directionalShadowAtlasDepth()
      );
    }
  });

  it('leaves an unlit material without it (edge case)', () => {
    installDirectionalShadowAtlas();
    expect(THREE.ShaderLib.basic.uniforms[DIRECTIONAL_SHADOW_ATLAS_UNIFORM]).toBeUndefined();
  });

  it('shares the atlas with a ShaderMaterial that merges three’s light uniforms', () => {
    installDirectionalShadowAtlas();
    const merged = THREE.UniformsUtils.merge([THREE.UniformsLib.lights]);
    expect(merged[DIRECTIONAL_SHADOW_ATLAS_UNIFORM]!.value).toBe(directionalShadowAtlasDepth());
  });

  it('patches each chunk once when called twice (edge case)', () => {
    installDirectionalShadowAtlas();
    installDirectionalShadowAtlas();
    expect(
      occurrences(THREE.ShaderChunk[PARS], `uniform sampler2DShadow ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM};`)
    ).toBe(1);
    expect(warningsOf(installDirectionalShadowAtlas)).toEqual([]);
  });

  it('leaves every chunk and material alone, and warns, when three lacks a sampler (error case)', () => {
    THREE.ShaderChunk[SHADOW_MASK] = 'void main() {}';
    expect(warningsOf(installDirectionalShadowAtlas)).toHaveLength(1);
    expect(THREE.ShaderChunk[PARS]).toBe(threeChunks[PARS]);
    expect(THREE.ShaderChunk[LIGHTS]).toBe(threeChunks[LIGHTS]);
    expect(THREE.ShaderLib.standard.uniforms[DIRECTIONAL_SHADOW_ATLAS_UNIFORM]).toBeUndefined();
  });
});
