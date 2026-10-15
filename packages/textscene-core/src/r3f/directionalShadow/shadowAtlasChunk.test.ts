/**
 * The patch is checked against the installed three's chunks, so a release that rewrites a sun
 * shadow sampler fails here and not in a golden.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installDirectionalShadowAtlas } from './shadowAtlasChunk';
import {
  DIRECTIONAL_SHADOW_ATLAS_UNIFORM,
  DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM,
  directionalShadowAtlasColour,
  directionalShadowAtlasDepth,
} from './shadowAtlas';
import { installGodotSplitShadow } from './splitShadowChunk';
import { installDirectionalShadowFade } from './shadowFade';
import { warningsOf } from '../testing/logWarnings';
import { LIT_SHADERS } from '../testing/litShaders';
import { installedShaderChunks, snapshotShaderGlobals } from '../testing/shaderPatches';

const PARS = 'shadowmap_pars_fragment';
const LIGHTS = 'lights_fragment_begin';
const SHADOW_MASK = 'shadowmask_pars_fragment';
const threeChunks = {
  [PARS]: THREE.ShaderChunk[PARS],
  [LIGHTS]: THREE.ShaderChunk[LIGHTS],
  [SHADOW_MASK]: THREE.ShaderChunk[SHADOW_MASK],
};
const ATLAS_ARGUMENT = `getSunShadow( ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM},`;

const occurrences = (text: string, part: string) => text.split(part).length - 1;

let restoreShaderGlobals: () => void;
beforeEach(() => {
  restoreShaderGlobals = snapshotShaderGlobals();
});
afterEach(() => restoreShaderGlobals());

/** The three chunks after the atlas and the other directional patches, in the given order. */
function installedInOrder(order: 'atlas first' | 'atlas last'): string[] {
  if (order === 'atlas first') installDirectionalShadowAtlas();
  installGodotSplitShadow();
  installDirectionalShadowFade();
  if (order === 'atlas last') installDirectionalShadowAtlas();
  return [THREE.ShaderChunk[PARS], THREE.ShaderChunk[LIGHTS], THREE.ShaderChunk[SHADOW_MASK]];
}

describe('the installed sun shadow chunks', () => {
  it('replace both of three’s per-shadow sun samplers with one atlas sampler', () => {
    const { [PARS]: pars } = installedShaderChunks();
    expect(pars).not.toContain('sunShadowMap');
    expect(pars).toContain(`uniform sampler2DShadow ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM};`);
    expect(pars).toContain(`uniform sampler2D ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM};`);
  });

  it('sample the atlas for every sun, in the lit materials and in ShadowMaterial', () => {
    const { [LIGHTS]: lights, [SHADOW_MASK]: shadowMask } = installedShaderChunks();
    for (const chunk of [lights, shadowMask]) {
      expect(chunk).not.toContain('sunShadowMap');
      expect(occurrences(chunk, ATLAS_ARGUMENT)).toBe(1);
    }
  });

  it('leave every directional shadow its own sampler (edge case)', () => {
    const { [PARS]: pars, [LIGHTS]: lights } = installedShaderChunks();
    expect(pars).toContain('uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];');
    expect(lights).toContain('getShadow( directionalShadowMap[ i ]');
  });

  it('fade the atlas lookup', () => {
    const { [LIGHTS]: lights } = installedShaderChunks();
    expect(occurrences(lights, `mix( ${ATLAS_ARGUMENT}`)).toBe(1);
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

  it('gives every lit built-in material the atlas colour, for the blocker search', () => {
    installDirectionalShadowAtlas();
    for (const name of LIT_SHADERS) {
      expect(THREE.ShaderLib[name]!.uniforms[DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM]!.value).toBe(
        directionalShadowAtlasColour()
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

  it('patches chunks the split lookup patched first, whose soft shadow names the atlas colour (edge case)', () => {
    installGodotSplitShadow();
    installDirectionalShadowAtlas();
    expect(THREE.ShaderChunk[PARS]).toContain(`uniform sampler2DShadow ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM};`);
    expect(THREE.ShaderChunk[LIGHTS]).toContain(ATLAS_ARGUMENT);
  });

  it('composes with the split lookup and the fade in either install order', () => {
    const atlasFirst = installedInOrder('atlas first');
    Object.assign(THREE.ShaderChunk, threeChunks);
    expect(installedInOrder('atlas last')).toEqual(atlasFirst);
  });

  it('patches each chunk once when called twice (edge case)', () => {
    installDirectionalShadowAtlas();
    installDirectionalShadowAtlas();
    expect(
      occurrences(THREE.ShaderChunk[PARS], `uniform sampler2DShadow ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM};`)
    ).toBe(1);
    expect(warningsOf(installDirectionalShadowAtlas)).toEqual([]);
  });

  it.each([PARS, LIGHTS, SHADOW_MASK] as const)(
    'leaves every chunk and material alone, and warns, when three’s %s lacks its sampler (error case)',
    (name) => {
      THREE.ShaderChunk[name] = 'void main() {}';
      expect(warningsOf(installDirectionalShadowAtlas)).toHaveLength(1);
      expect({
        [PARS]: THREE.ShaderChunk[PARS],
        [LIGHTS]: THREE.ShaderChunk[LIGHTS],
        [SHADOW_MASK]: THREE.ShaderChunk[SHADOW_MASK],
      }).toEqual({ ...threeChunks, [name]: 'void main() {}' });
      expect(THREE.ShaderLib.standard.uniforms[DIRECTIONAL_SHADOW_ATLAS_UNIFORM]).toBeUndefined();
    }
  );
});
