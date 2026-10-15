/**
 * The omni and spot lookups sample the one atlas through Godot's lookups, and nothing else changes.
 * The chunks are read as installed on the installed three, so a release that rewrites an edited line
 * fails here, not in a golden.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installGodotPositionalShadow } from './positionalShadowChunk';
import {
  POSITIONAL_SHADOW_ATLAS_COLOUR_UNIFORM,
  POSITIONAL_SHADOW_ATLAS_UNIFORM,
  positionalShadowAtlasColour,
  positionalShadowAtlasDepth,
} from './shadowAtlasTarget';
import { AREA_LIGHT_SHADOWS } from '../areaLight/areaLightShadowUniforms';
import { occurrences, preprocessorBranch } from '../testing/glslSource';
import { warningsOf } from '../testing/logWarnings';
import { installGodotSplitShadow } from '../directionalShadow/splitShadowChunk';
import { installDirectionalShadowAtlas } from '../directionalShadow/shadowAtlasChunk';
import { LIT_SHADERS } from '../testing/litShaders';
import { installedShaderChunks, FILTER_PCF, restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

const PATCHED_CHUNKS = [
  'shadowmap_vertex',
  'shadowmap_pars_fragment',
  'lights_fragment_begin',
  'shadowmask_pars_fragment',
] as const;
type PatchedChunk = (typeof PATCHED_CHUNKS)[number];

/** The four chunks as `THREE.ShaderChunk` holds them now. */
function currentChunks(): Record<PatchedChunk, string> {
  return Object.fromEntries(PATCHED_CHUNKS.map((name) => [name, THREE.ShaderChunk[name]])) as Record<
    PatchedChunk,
    string
  >;
}

const threeChunks = currentChunks();

restoreShaderGlobalsAfterEach();

describe('the installed positional shadow chunks', () => {
  it('replaces every omni and spot sampler with one atlas sampler', () => {
    const patched = installedShaderChunks();
    for (const chunk of PATCHED_CHUNKS.map((name) => patched[name])) {
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
    const { lights_fragment_begin: lights, shadowmask_pars_fragment: mask } = installedShaderChunks();
    for (const chunk of [lights, mask]) {
      expect(occurrences(chunk, 'godotOmniShadow( pointShadowMatrix[ i ], vPointShadowCoord[ i ].xyz,')).toBe(
        1
      );
      expect(occurrences(chunk, 'godotSpotShadow(')).toBe(1);
    }
    expect(lights).toContain('godotOmniLocalNormal( pointShadowMatrix[ i ], normal )');
    expect(lights).toContain('godotSpotShadowCoord( vSpotLightCoord[ i ], spotLightMatrix[ i ],');
  });

  it('looks up each area light’s shadow through the atlas, for the area light chunk to call', () => {
    const { shadowmap_pars_fragment: pars } = installedShaderChunks();
    const area = preprocessorBranch(pars, '#if NUM_RECT_AREA_LIGHTS > 0');
    expect(area).toContain('float godotAreaShadow(');
    expect(area).toContain(
      '#define GODOT_AREA_SHADOW( index ) godotAreaShadow( index, geometryPosition, geometryNormal )'
    );
    expect(pars).toContain(
      '#if NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 || NUM_RECT_AREA_LIGHTS > 0'
    );
  });

  it('reads both shadow matrices in the fragment stage at the vertex stage’s precision', () => {
    const { shadowmap_pars_fragment: pars } = installedShaderChunks();
    expect(pars).toContain('uniform highp mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];');
    expect(pars).toContain('uniform highp mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];');
  });

  it('drops three’s vertex offsets for omni and spot lights, and keeps the directional one', () => {
    const { shadowmap_vertex: vertex } = installedShaderChunks();
    expect(vertex).not.toContain('pointLightShadows[ i ].shadowNormalBias');
    expect(vertex).not.toContain('spotLightShadows[ i ].shadowNormalBias');
    expect(vertex).toContain('directionalLightShadows[ i ].shadowNormalBias');
  });
});

describe('installGodotPositionalShadow', () => {
  it('puts Godot’s omni and spot lookups in three’s chunks', () => {
    installGodotPositionalShadow();
    expect(THREE.ShaderChunk.lights_fragment_begin).toContain('godotOmniShadow(');
    expect(THREE.ShaderChunk.shadowmask_pars_fragment).toContain('godotSpotShadow(');
  });

  it('leaves the directional lookups alone (edge case)', () => {
    installGodotPositionalShadow();
    const lights = THREE.ShaderChunk.lights_fragment_begin;
    expect(lights).toContain('vDirectionalShadowCoord[ i ] )');
    expect(lights).toContain('getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX )');
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

  it('gives every lit built-in material the atlas colour and the area lights’ shadow terms', () => {
    installGodotPositionalShadow();
    const uniforms = THREE.ShaderLib.physical.uniforms;
    expect(uniforms[POSITIONAL_SHADOW_ATLAS_COLOUR_UNIFORM]!.value).toBe(positionalShadowAtlasColour());
    expect(uniforms[AREA_LIGHT_SHADOWS]!.value).toBeInstanceOf(Float32Array);
  });

  it('follows Godot’s soft shadow filter, which the install puts in first', () => {
    installGodotPositionalShadow();
    const pars = THREE.ShaderChunk.shadowmap_pars_fragment;
    expect(occurrences(pars, FILTER_PCF)).toBe(1);
    expect(pars.indexOf(FILTER_PCF)).toBeLessThan(pars.indexOf('float godotSpotShadow('));
    expect(pars.indexOf(FILTER_PCF)).toBeLessThan(pars.indexOf('float godotOmniPcf('));
  });

  it('declares the filter once beside the directional patches, in either install order', () => {
    installGodotPositionalShadow();
    installGodotSplitShadow();
    const positionalFirst = THREE.ShaderChunk.shadowmap_pars_fragment;
    Object.assign(THREE.ShaderChunk, threeChunks);
    installGodotSplitShadow();
    installGodotPositionalShadow();
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(positionalFirst);
    expect(occurrences(positionalFirst, FILTER_PCF)).toBe(1);
  });

  it('composes with the directional patches, which `TscnCanvas` installs first', () => {
    installGodotSplitShadow();
    installDirectionalShadowAtlas();
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

  it.each(['shadowmap_vertex', 'lights_fragment_begin', 'shadowmask_pars_fragment'] as const)(
    'leaves chunks and materials alone, and warns, when three’s %s lacks an edited text (error case)',
    (name) => {
      THREE.ShaderChunk[name] = 'void main() {}';
      const warnings = warningsOf(() => installGodotPositionalShadow());
      const unpatched = { ...threeChunks, [name]: 'void main() {}' };
      // The soft shadow filter installs first, so only the shadow chunk changes.
      for (const chunk of PATCHED_CHUNKS.filter((chunk) => chunk !== 'shadowmap_pars_fragment')) {
        expect(THREE.ShaderChunk[chunk]).toBe(unpatched[chunk]);
      }
      expect(THREE.ShaderChunk.shadowmap_pars_fragment).not.toContain('godotSpotShadow(');
      expect(THREE.ShaderLib.standard.uniforms[POSITIONAL_SHADOW_ATLAS_UNIFORM]).toBeUndefined();
      expect(warnings).toHaveLength(1);
    }
  );
});
