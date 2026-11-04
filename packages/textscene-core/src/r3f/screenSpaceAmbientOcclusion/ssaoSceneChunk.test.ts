/**
 * The occlusion rides three's AO chunk. A three release that rewrites an anchor fails here, not
 * silently in a capture.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SSAO_UNIFORM } from './ssaoUniforms';
import { installGodotScreenSpaceAmbientOcclusion } from './ssaoSceneChunk';
import { installedShaderChunks, restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

restoreShaderGlobalsAfterEach();

const chunks = installedShaderChunks();
const ao = chunks.aomap_fragment;
const FOLD_MIN = 'ambientOcclusion = min( ambientOcclusion, godotScreenSpaceOcclusion() );';

describe('installGodotScreenSpaceAmbientOcclusion', () => {
  it("keeps the darker of the surface's occlusion and the screen's (scene_forward_clustered.glsl:2039)", () => {
    expect(ao).toContain(FOLD_MIN);
  });

  it('raises the light affect toward its own only as far as the channel affect reaches (:2040)', () => {
    expect(ao).toContain(
      `godotLightAffect = mix( godotLightAffect, max( godotLightAffect, ${SSAO_UNIFORM.fold}.x ), ${SSAO_UNIFORM.fold}.y );`
    );
  });

  it("folds after the surface's own occlusion and the decals' mix, before any light reads it", () => {
    const foldAt = ao.indexOf(FOLD_MIN);

    expect(foldAt).toBeGreaterThan(ao.indexOf('godotOcclusionMix.y;'));
    expect(foldAt).toBeLessThan(ao.indexOf('reflectedLight.indirectDiffuse *= ambientOcclusion;'));
    expect(foldAt).toBeLessThan(ao.indexOf('float godotDirectOcclusion'));
  });

  it('folds only in a lit program while a render shows its occlusion, so the switch compiles nothing', () => {
    const gate = ao.slice(ao.indexOf('#if defined( STANDARD )'), ao.indexOf(FOLD_MIN));

    expect(gate).toContain('godotScreenSpaceState.w > 0.5');
  });

  it("reads Godot's black default where no occlusion was drawn (render_forward_clustered.cpp:3530)", () => {
    expect(chunks.lights_physical_pars_fragment).toContain(`if ( ${SSAO_UNIFORM.fold}.z < 0.5 ) return 0.0;`);
  });

  it('gives every lit material the occlusion and its fold', () => {
    installGodotScreenSpaceAmbientOcclusion();

    expect(Object.keys(THREE.ShaderLib.physical.uniforms)).toEqual(
      expect.arrayContaining([SSAO_UNIFORM.occlusion, SSAO_UNIFORM.fold])
    );
  });
});
