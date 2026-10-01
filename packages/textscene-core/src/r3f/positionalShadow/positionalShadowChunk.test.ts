/**
 * The omni and spot lookups take Godot's receiver offsets and nothing else changes. The first test
 * reads the installed three, so a release that rewrites an edited line fails here, not in a golden.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  POSITIONAL_SHADOW_EDITS,
  installGodotPositionalShadow,
  positionalShadowChunks,
} from './positionalShadowChunk';
import { warningsOf } from '../testing/logWarnings';
import { installGodotSplitShadow } from '../directionalShadow/splitShadowChunk';
import { installDirectionalShadowFade } from '../directionalShadow/shadowFade';
import { installDirectionalShadowAtlas } from '../directionalShadow/shadowAtlasChunk';

const threeChunks = {
  shadowmap_vertex: THREE.ShaderChunk.shadowmap_vertex,
  shadowmap_pars_fragment: THREE.ShaderChunk.shadowmap_pars_fragment,
  lights_fragment_begin: THREE.ShaderChunk.lights_fragment_begin,
};

const occurrences = (text: string, part: string) => text.split(part).length - 1;

afterEach(() => {
  Object.assign(THREE.ShaderChunk, threeChunks);
});

describe('positionalShadowChunks', () => {
  it('finds each edited text exactly once in the installed three', () => {
    for (const { chunk, three } of POSITIONAL_SHADOW_EDITS) {
      expect(occurrences(threeChunks[chunk], three)).toBe(1);
    }
  });

  it('drops three’s vertex offsets for omni and spot lights, and keeps the directional one', () => {
    const { shadowmap_vertex: vertex } = positionalShadowChunks(threeChunks)!;
    expect(vertex).not.toContain('pointLightShadows[ i ].shadowNormalBias');
    expect(vertex).not.toContain('spotLightShadows[ i ].shadowNormalBias');
    expect(vertex).toContain('directionalLightShadows[ i ].shadowNormalBias');
  });

  it('routes both lookups through Godot’s offsets, with three’s own bias at zero', () => {
    const { lights_fragment_begin: lights, shadowmap_pars_fragment: pars } =
      positionalShadowChunks(threeChunks)!;
    expect(lights).toContain('0.0, pointLightShadow.shadowRadius, godotOmniShadowCoord(');
    expect(lights).toContain('0.0, spotLightShadow.shadowRadius, godotSpotShadowCoord(');
    expect(pars).toContain('vec4 godotOmniShadowCoord(');
    expect(pars).toContain('float godotOmniShadow( samplerCubeShadow shadowMap,');
    expect(lights).toContain('? godotOmniShadow( pointShadowMap[ i ],');
    expect(pars).toContain('vec4 godotSpotShadowCoord(');
    expect(pars).toContain('uniform highp mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];');
  });

  it('leaves the directional lookups alone (edge case)', () => {
    const { lights_fragment_begin: lights } = positionalShadowChunks(threeChunks)!;
    expect(lights).toContain('vDirectionalShadowCoord[ i ] )');
    expect(lights).toContain('getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX )');
  });

  it('is null for chunks without the edited text (error case)', () => {
    expect(positionalShadowChunks({ ...threeChunks, lights_fragment_begin: 'void main() {}' })).toBeNull();
  });
});

describe('installGodotPositionalShadow', () => {
  it('replaces three’s chunks with the patched ones', () => {
    installGodotPositionalShadow();
    expect(THREE.ShaderChunk.lights_fragment_begin).toBe(
      positionalShadowChunks(threeChunks)!.lights_fragment_begin
    );
    expect(THREE.ShaderChunk.shadowmap_vertex).toBe(positionalShadowChunks(threeChunks)!.shadowmap_vertex);
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

  it('leaves chunks it cannot patch alone, and warns (error case)', () => {
    THREE.ShaderChunk.shadowmap_vertex = 'void main() {}';
    const warnings = warningsOf(() => installGodotPositionalShadow());
    expect(THREE.ShaderChunk.shadowmap_vertex).toBe('void main() {}');
    expect(THREE.ShaderChunk.lights_fragment_begin).toBe(threeChunks.lights_fragment_begin);
    expect(warnings).toHaveLength(1);
  });
});
