import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { renderTargetMapInjection, renderTargetMapUserData, type TargetMapSampler } from './renderTargetMap';
import type { ProgramShader } from '../materialProgramInputs';
import { programShader } from '../testing/patchedFragment';

const FLIPPED_V = { repeat: { x: 2, y: -3 }, offset: { x: 0.25, y: 1 } };
const REPEATING: TargetMapSampler = { uv: FLIPPED_V, repeats: true, isNearest: false };

function recording(sampler: TargetMapSampler): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ userData: renderTargetMapUserData(sampler) });
}

/** The shader `material`'s render-target albedo patch leaves, from three's basic program. */
function patched(material: THREE.Material): ProgramShader {
  const shader = programShader('basic');
  renderTargetMapInjection(material.userData)!.onBeforeCompile.call(material, shader);
  return shader;
}

function transformUniform(material: THREE.Material): THREE.Matrix3 {
  return patched(material).uniforms['godotTargetMapTransform']!.value as THREE.Matrix3;
}

describe('renderTargetMapInjection: the UV transform', () => {
  it("writes the map's coordinate after three's chunk, through the material's own transform", () => {
    const { vertexShader } = patched(recording(REPEATING));

    expect(
      vertexShader.indexOf('vMapUv = ( godotTargetMapTransform * vec3( MAP_UV, 1 ) ).xy;')
    ).toBeGreaterThan(vertexShader.indexOf('#include <uv_vertex>'));
  });

  it('uploads the transform the material records, as three builds a texture matrix', () => {
    expect(transformUniform(recording(REPEATING))).toEqual(
      new THREE.Matrix3().setUvTransform(0.25, 1, 2, -3, 0, 0, 0)
    );
  });

  it('reads the transform at each upload, so a new one needs no recompile', () => {
    const material = recording(REPEATING);
    const uniform = patched(material).uniforms['godotTargetMapTransform']!;

    material.userData = renderTargetMapUserData({
      ...REPEATING,
      uv: { repeat: { x: 1, y: 1 }, offset: { x: 0.5, y: 0 } },
    });

    expect(uniform.value).toEqual(new THREE.Matrix3().setUvTransform(0.5, 0, 1, 1, 0, 0, 0));
  });

  it('samples the target untransformed once the material records none (edge case)', () => {
    const material = recording(REPEATING);
    const uniform = patched(material).uniforms['godotTargetMapTransform']!;

    material.userData = {};

    expect((uniform.value as THREE.Matrix3).equals(new THREE.Matrix3())).toBe(true);
  });

  it('patches nothing on a material that records no render-target albedo (edge case)', () => {
    expect(renderTargetMapInjection({})).toBeUndefined();
  });
});

describe("renderTargetMapInjection: Godot's sampler", () => {
  it("samples the map by hand in place of three's hardware sample", () => {
    const { fragmentShader } = patched(recording(REPEATING));

    expect(fragmentShader).toContain('vec4 sampledDiffuseColor = godotTargetMapSample( vMapUv );');
    expect(fragmentShader).not.toContain('#include <map_fragment>');
  });

  it.each([
    ['wraps under texture_repeat', REPEATING, ['GODOT_TARGET_MAP_WRAPS'], ['GODOT_TARGET_MAP_NEAREST']],
    [
      'reads the nearest texel under a nearest texture_filter',
      { ...REPEATING, repeats: false, isNearest: true },
      ['GODOT_TARGET_MAP_NEAREST'],
      ['GODOT_TARGET_MAP_WRAPS'],
    ],
    [
      'wraps the nearest texel under both',
      { ...REPEATING, isNearest: true },
      ['GODOT_TARGET_MAP_WRAPS', 'GODOT_TARGET_MAP_NEAREST'],
      [],
    ],
  ])('%s', (_case, sampler, defined, undefinedDefines) => {
    const { fragmentShader } = patched(recording(sampler));

    for (const define of defined) expect(fragmentShader).toContain(`#define ${define}\n`);
    for (const define of undefinedDefines) expect(fragmentShader).not.toContain(`#define ${define}\n`);
  });

  it("keeps three's sample for a linear sampler that clamps, as the target's own is (edge case)", () => {
    const { fragmentShader } = patched(recording({ ...REPEATING, repeats: false }));

    expect(fragmentShader).toContain('#include <map_fragment>');
  });

  it('compiles one program per sampler state, so equal states share it', () => {
    const nearest = { ...REPEATING, isNearest: true };

    expect(renderTargetMapInjection(renderTargetMapUserData(nearest))).toBe(
      renderTargetMapInjection(renderTargetMapUserData({ ...nearest, uv: FLIPPED_V }))
    );
    expect(renderTargetMapInjection(renderTargetMapUserData(nearest))).not.toBe(
      renderTargetMapInjection(renderTargetMapUserData(REPEATING))
    );
  });
});
