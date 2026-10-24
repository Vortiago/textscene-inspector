/**
 * A lit program scales its emission by the exposure normalisation factor, as Godot's scene shader
 * does for every shaded material (`scene_forward_clustered.glsl:1679-1683`). The tests read the
 * installed three, so a release that rewrites the replaced line fails here.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EMISSION_EXPOSURE, installEmissionExposure } from './emissionExposure';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';
import { warningsOf } from '../testing/logWarnings';

restoreShaderGlobalsAfterEach();

const LIT_PROGRAMS = ['lambert', 'phong', 'standard', 'physical', 'toon'] as const;

describe('installEmissionExposure', () => {
  it('declares the factor beside the emissive map', () => {
    installEmissionExposure();
    expect(THREE.ShaderChunk.emissivemap_pars_fragment).toContain(
      'uniform float godotEmissionExposure[ 1 ];'
    );
  });

  it('scales the emission after the emissive map has multiplied it, a map or not', () => {
    installEmissionExposure();
    const chunk = THREE.ShaderChunk.emissivemap_fragment;
    expect(chunk.indexOf('totalEmissiveRadiance *= godotEmissionExposure[ 0 ];')).toBeGreaterThan(
      chunk.indexOf('totalEmissiveRadiance *= emissiveColor.rgb;')
    );
    expect(chunk.trimEnd().endsWith('totalEmissiveRadiance *= godotEmissionExposure[ 0 ];')).toBe(true);
  });

  it.each(LIT_PROGRAMS)('gives the one shared factor to the %s program', (program) => {
    installEmissionExposure();
    expect(THREE.ShaderLib[program].uniforms.godotEmissionExposure?.value).toBe(EMISSION_EXPOSURE);
  });

  it.each(LIT_PROGRAMS)(
    'declares the emission before the %s program includes the chunk that scales it',
    (program) => {
      const fragment = THREE.ShaderLib[program].fragmentShader;
      expect(fragment.indexOf('vec3 totalEmissiveRadiance = emissive;')).toBeGreaterThan(-1);
      expect(fragment.indexOf('vec3 totalEmissiveRadiance = emissive;')).toBeLessThan(
        fragment.indexOf('#include <emissivemap_fragment>')
      );
    }
  );

  it('starts at the factor 1, which scales nothing', () => {
    expect(Array.from(EMISSION_EXPOSURE)).toEqual([1]);
  });

  it('leaves an unshaded program without emission to scale', () => {
    installEmissionExposure();
    expect(THREE.ShaderLib.basic.fragmentShader).not.toContain('emissivemap_fragment');
  });

  it('changes nothing on a second call (edge case)', () => {
    installEmissionExposure();
    const once = THREE.ShaderChunk.emissivemap_fragment;
    installEmissionExposure();
    expect(THREE.ShaderChunk.emissivemap_fragment).toBe(once);
  });

  it("keeps three's chunks and warns when three lacks the emissive map line (error case)", () => {
    THREE.ShaderChunk.emissivemap_pars_fragment = '';
    const warnings = warningsOf(() => installEmissionExposure());
    expect(THREE.ShaderChunk.emissivemap_pars_fragment).toBe('');
    expect(warnings.join('\n')).toContain('emissivemap_pars_fragment');
  });
});
