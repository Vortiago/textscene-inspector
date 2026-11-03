import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ProgramShader } from '../materialProgramInputs';
import { metallicRoughnessChannelsUserData } from '../materials/godotMetallicRoughnessChannels';
import { UNSHADED_ROUGHNESS, UNLIT_DEFAULT_ROUGHNESS, unshadedRoughnessUserData } from './unshadedRoughness';

/** The uniforms the injection declares. */
const ROUGHNESS = 'godotUnshadedRoughness';
const CHANNEL = 'godotRoughnessTextureChannel';

function compiled(material: THREE.Material): ProgramShader {
  const shader: ProgramShader = {
    vertexShader: '',
    fragmentShader: `void main() {\n\t${UNLIT_DEFAULT_ROUGHNESS}\n}`,
    uniforms: {},
  };
  UNSHADED_ROUGHNESS.onBeforeCompile.call(material, shader);
  return shader;
}

describe('UNSHADED_ROUGHNESS', () => {
  it("writes the material's roughness, scaled by its roughness map, in place of the default", () => {
    const { fragmentShader } = compiled(new THREE.MeshBasicMaterial());

    expect(fragmentShader).not.toContain(UNLIT_DEFAULT_ROUGHNESS);
    expect(fragmentShader).toContain(`godotUnlitRoughness = ${ROUGHNESS};`);
    expect(fragmentShader).toContain(`dot( texelSpecular, ${CHANNEL} )`);
  });

  it("reads the material's roughness at each upload", () => {
    const material = new THREE.MeshBasicMaterial({ userData: unshadedRoughnessUserData(0.4) });
    const { uniforms } = compiled(material);
    material.userData = unshadedRoughnessUserData(0.2);

    expect(uniforms[ROUGHNESS]!.value).toBe(0.2);
  });

  it("reads the roughness map's channel the material records", () => {
    const userData = metallicRoughnessChannelsUserData([0, 0, 1, 0], [1, 0, 0, 0]);
    const { uniforms } = compiled(new THREE.MeshBasicMaterial({ userData }));

    expect(uniforms[CHANNEL]!.value).toEqual([0, 0, 1, 0]);
  });

  it("reads Godot's default roughness, 1, for a material that records none", () => {
    const { uniforms } = compiled(new THREE.MeshBasicMaterial());

    expect(uniforms[ROUGHNESS]!.value).toBe(1);
  });
});
