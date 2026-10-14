import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { renderTargetMapInjection, renderTargetMapUserData } from './renderTargetMap';
import type { ProgramShader } from '../materialProgramInputs';

const FLIPPED_V = { scale: { x: 2, y: -3 }, offset: { x: 0.25, y: 1 } };

/** The shader a render-target albedo patch leaves for `material`, from three's basic program. */
function patchedFor(material: THREE.Material, repeats = true): ProgramShader {
  const shader: ProgramShader = {
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    uniforms: {},
  };
  renderTargetMapInjection(repeats)!.onBeforeCompile.call(material, shader);
  return shader;
}

function transformUniform(material: THREE.Material): THREE.Matrix3 {
  return patchedFor(material).uniforms['godotTargetMapTransform']!.value as THREE.Matrix3;
}

describe('renderTargetMapInjection: the UV transform', () => {
  it("writes the map's coordinate after three's chunk, through the material's own transform", () => {
    const { vertexShader } = patchedFor(new THREE.MeshBasicMaterial());

    expect(
      vertexShader.indexOf('vMapUv = ( godotTargetMapTransform * vec3( MAP_UV, 1 ) ).xy;')
    ).toBeGreaterThan(vertexShader.indexOf('#include <uv_vertex>'));
  });

  it('uploads the transform the material records, as three builds a texture matrix', () => {
    const material = new THREE.MeshBasicMaterial({ userData: renderTargetMapUserData(FLIPPED_V) });

    expect(transformUniform(material)).toEqual(new THREE.Matrix3().setUvTransform(0.25, 1, 2, -3, 0, 0, 0));
  });

  it('reads the transform at each upload, so a new one needs no recompile', () => {
    const material = new THREE.MeshBasicMaterial();
    const uniform = patchedFor(material).uniforms['godotTargetMapTransform']!;

    material.userData = renderTargetMapUserData(FLIPPED_V);

    expect(uniform.value).toEqual(new THREE.Matrix3().setUvTransform(0.25, 1, 2, -3, 0, 0, 0));
  });

  it('samples the target untransformed on a material that records none (edge case)', () => {
    expect(transformUniform(new THREE.MeshBasicMaterial()).equals(new THREE.Matrix3())).toBe(true);
  });
});

describe('renderTargetMapInjection: the wrap', () => {
  it("samples the map through the wrapped filter in place of three's hardware sample", () => {
    const { fragmentShader } = patchedFor(new THREE.MeshBasicMaterial());

    expect(fragmentShader).toContain('vec4 sampledDiffuseColor = godotTargetMapSample( vMapUv );');
    expect(fragmentShader).not.toContain('#include <map_fragment>');
  });

  it('wraps each texel index, as a repeating sampler does', () => {
    expect(patchedFor(new THREE.MeshBasicMaterial()).fragmentShader).toContain(
      'ivec2 far = ivec2( mod( corner + 1.0, size ) );'
    );
  });

  it("keeps three's clamped sample for a material that does not repeat (edge case)", () => {
    expect(patchedFor(new THREE.MeshBasicMaterial(), false).fragmentShader).toContain(
      '#include <map_fragment>'
    );
  });
});
