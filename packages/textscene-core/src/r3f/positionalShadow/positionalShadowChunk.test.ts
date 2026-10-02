/**
 * The omni and spot lookups sample the one atlas through Godot's lookups, and nothing else changes.
 * The first test reads the installed three, so a release that rewrites an edited line fails here,
 * not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  POSITIONAL_SHADOW_EDITS,
  installGodotPositionalShadow,
  positionalShadowChunks,
  type PositionalShadowChunks,
} from './positionalShadowChunk';
import { POSITIONAL_SHADOW_ATLAS_UNIFORM, positionalShadowAtlasDepth } from './shadowAtlasTarget';
import { warningsOf } from '../testing/logWarnings';
import { installGodotSplitShadow } from '../directionalShadow/splitShadowChunk';
import { installDirectionalShadowFade } from '../directionalShadow/shadowFade';
import { installDirectionalShadowAtlas } from '../directionalShadow/shadowAtlasChunk';

const threeChunks: PositionalShadowChunks = {
  shadowmap_vertex: THREE.ShaderChunk.shadowmap_vertex,
  shadowmap_pars_fragment: THREE.ShaderChunk.shadowmap_pars_fragment,
  lights_fragment_begin: THREE.ShaderChunk.lights_fragment_begin,
  shadowmask_pars_fragment: THREE.ShaderChunk.shadowmask_pars_fragment,
};
const LIT_SHADERS = ['lambert', 'phong', 'standard', 'physical', 'toon', 'shadow'] as const;

const occurrences = (text: string, part: string) => text.split(part).length - 1;

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
  for (const shader of Object.values(THREE.ShaderLib))
    delete shader.uniforms[POSITIONAL_SHADOW_ATLAS_UNIFORM];
  delete (THREE.UniformsLib.lights as Record<string, THREE.IUniform>)[POSITIONAL_SHADOW_ATLAS_UNIFORM];
});

describe('positionalShadowChunks', () => {
  it('finds each edited text exactly once in the installed three', () => {
    for (const { chunk, three } of POSITIONAL_SHADOW_EDITS) {
      expect(occurrences(threeChunks[chunk], three)).toBe(1);
    }
  });

  it('replaces every omni and spot sampler with one atlas sampler', () => {
    const patched = positionalShadowChunks(threeChunks)!;
    for (const chunk of Object.values(patched)) {
      expect(chunk).not.toContain('pointShadowMap[ i ]');
      expect(chunk).not.toContain('spotShadowMap[ i ]');
    }
    expect(patched.shadowmap_pars_fragment).not.toMatch(/uniform \w+ (point|spot)ShadowMap\[/);
    expect(
      occurrences(
        patched.shadowmap_pars_fragment,
        `uniform sampler2DShadow ${POSITIONAL_SHADOW_ATLAS_UNIFORM};`
      )
    ).toBe(1);
  });

  it('samples the atlas for every omni and spot light, in the lit materials and in ShadowMaterial', () => {
    const { lights_fragment_begin: lights, shadowmask_pars_fragment: mask } =
      positionalShadowChunks(threeChunks)!;
    for (const chunk of [lights, mask]) {
      expect(occurrences(chunk, 'godotOmniShadow( pointShadowMatrix[ i ], vPointShadowCoord[ i ].xyz,')).toBe(
        1
      );
      expect(occurrences(chunk, 'godotSpotShadow(')).toBe(1);
    }
    expect(lights).toContain('godotOmniLocalNormal( pointShadowMatrix[ i ], normal )');
    expect(lights).toContain('godotSpotShadowCoord( vSpotLightCoord[ i ], spotLightMatrix[ i ],');
  });

  it('reads both shadow matrices in the fragment stage at the vertex stage’s precision', () => {
    const { shadowmap_pars_fragment: pars } = positionalShadowChunks(threeChunks)!;
    expect(pars).toContain('uniform highp mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];');
    expect(pars).toContain('uniform highp mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];');
  });

  it('drops three’s vertex offsets for omni and spot lights, and keeps the directional one', () => {
    const { shadowmap_vertex: vertex } = positionalShadowChunks(threeChunks)!;
    expect(vertex).not.toContain('pointLightShadows[ i ].shadowNormalBias');
    expect(vertex).not.toContain('spotLightShadows[ i ].shadowNormalBias');
    expect(vertex).toContain('directionalLightShadows[ i ].shadowNormalBias');
  });

  it('leaves the directional lookups alone (edge case)', () => {
    const { lights_fragment_begin: lights } = positionalShadowChunks(threeChunks)!;
    expect(lights).toContain('vDirectionalShadowCoord[ i ] )');
    expect(lights).toContain('getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX )');
  });

  it('is null for chunks without the edited text (error case)', () => {
    expect(positionalShadowChunks({ ...threeChunks, lights_fragment_begin: 'void main() {}' })).toBeNull();
    expect(positionalShadowChunks({ ...threeChunks, shadowmask_pars_fragment: 'void main() {}' })).toBeNull();
  });
});

describe('installGodotPositionalShadow', () => {
  it('replaces three’s chunks with the patched ones', () => {
    installGodotPositionalShadow();
    const patched = positionalShadowChunks(threeChunks)!;
    for (const [name, chunk] of Object.entries(patched)) {
      expect(THREE.ShaderChunk[name as keyof PositionalShadowChunks]).toBe(chunk);
    }
  });

  it('gives every lit built-in material and three’s light uniforms the one atlas', () => {
    installGodotPositionalShadow();
    for (const name of LIT_SHADERS) {
      expect(THREE.ShaderLib[name]!.uniforms[POSITIONAL_SHADOW_ATLAS_UNIFORM]!.value).toBe(
        positionalShadowAtlasDepth()
      );
    }
    const merged = THREE.UniformsUtils.merge([THREE.UniformsLib.lights]);
    expect(merged[POSITIONAL_SHADOW_ATLAS_UNIFORM]!.value).toBe(positionalShadowAtlasDepth());
    expect(THREE.ShaderLib.basic.uniforms[POSITIONAL_SHADOW_ATLAS_UNIFORM]).toBeUndefined();
  });

  it('composes with the directional patches, which `TscnCanvas` installs first', () => {
    installGodotSplitShadow();
    installDirectionalShadowAtlas();
    installDirectionalShadowFade();
    const warnings = warningsOf(() => installGodotPositionalShadow());
    expect(warnings).toEqual([]);
    expect(THREE.ShaderChunk.lights_fragment_begin).toContain('godotSpotShadowCoord(');
  });

  it('changes nothing on a second call (edge case)', () => {
    installGodotPositionalShadow();
    const once = THREE.ShaderChunk.shadowmap_pars_fragment;
    installGodotPositionalShadow();
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(once);
  });

  it('leaves chunks and materials alone, and warns, when it cannot patch (error case)', () => {
    THREE.ShaderChunk.shadowmap_vertex = 'void main() {}';
    const warnings = warningsOf(() => installGodotPositionalShadow());
    expect(THREE.ShaderChunk.shadowmap_vertex).toBe('void main() {}');
    expect(THREE.ShaderChunk.lights_fragment_begin).toBe(threeChunks.lights_fragment_begin);
    expect(THREE.ShaderLib.standard.uniforms[POSITIONAL_SHADOW_ATLAS_UNIFORM]).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });
});
