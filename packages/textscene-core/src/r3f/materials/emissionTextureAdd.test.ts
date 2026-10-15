import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { emissionTextureAddInjection, emissionTextureAddUserData } from './emissionTextureAdd';
import type { ProgramShader } from '../materialProgramInputs';

function recording(energy: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ userData: emissionTextureAddUserData(energy) });
}

/** The shader the ADD patch leaves, from three's standard program. */
function patched(material: THREE.Material): ProgramShader {
  const shader: ProgramShader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  emissionTextureAddInjection(0)!.onBeforeCompile.call(material, shader, undefined as never);
  return shader;
}

describe('emissionTextureAddInjection', () => {
  it('adds the texel at the energy where three multiplies the colour by it', () => {
    const { fragmentShader } = patched(recording(2));

    expect(fragmentShader).toContain(
      'totalEmissiveRadiance += emissiveColor.rgb * godotEmissionTextureEnergy;'
    );
    expect(fragmentShader).not.toContain('totalEmissiveRadiance *= emissiveColor.rgb;');
    expect(fragmentShader).toContain('uniform float godotEmissionTextureEnergy;');
  });

  it('reads the energy the material records at each upload, so an edit needs no recompile', () => {
    const material = recording(2);
    const uniform = patched(material).uniforms['godotEmissionTextureEnergy']!;
    material.userData = emissionTextureAddUserData(5);

    expect(uniform.value).toBe(5);
  });

  it('patches nothing for a material whose texture adds nothing (edge case)', () => {
    expect(emissionTextureAddInjection(null)).toBeUndefined();
    expect(emissionTextureAddUserData(null)).toEqual({});
  });

  it('reads zero from a material that records no energy (error case)', () => {
    const uniform = patched(new THREE.MeshStandardMaterial()).uniforms['godotEmissionTextureEnergy']!;

    expect(uniform.value).toBe(0);
  });
});
