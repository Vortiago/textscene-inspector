import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  GODOT_METALLIC_ROUGHNESS_CHANNELS,
  metallicRoughnessChannelsUserData,
} from './godotMetallicRoughnessChannels';
import type { ProgramShader } from '../materialProgramInputs';
import { TextureChannel, textureChannelMask } from '../../godot/rendering/materials/textureChannel';

const RED = textureChannelMask(TextureChannel.TEXTURE_CHANNEL_RED);
const ALPHA = textureChannelMask(TextureChannel.TEXTURE_CHANNEL_ALPHA);
const STANDARD_FRAGMENT = THREE.ShaderLib.standard.fragmentShader;

/** The shader `GODOT_METALLIC_ROUGHNESS_CHANNELS` leaves for `material`. */
function patchedFor(material: THREE.Material, fragmentShader: string): ProgramShader {
  const shader: ProgramShader = { vertexShader: '', fragmentShader, uniforms: {} };
  GODOT_METALLIC_ROUGHNESS_CHANNELS.onBeforeCompile.call(material, shader);
  return shader;
}

describe.each([
  ['MeshStandardMaterial', THREE.ShaderLib.standard.fragmentShader],
  ['MeshPhysicalMaterial', THREE.ShaderLib.physical.fragmentShader],
])('GODOT_METALLIC_ROUGHNESS_CHANNELS on the %s fragment shader', (_type, fragmentShader) => {
  const patched = patchedFor(new THREE.MeshStandardMaterial(), fragmentShader).fragmentShader;

  it('reads the roughness map through its channel mask, not its green channel', () => {
    // `material.cpp:1725`.
    expect(patched).toContain('roughnessFactor *= dot( texelRoughness, godotRoughnessTextureChannel );');
  });

  it('reads the metallic map through its channel mask, not its blue channel', () => {
    // `material.cpp:1685`.
    expect(patched).toContain('metalnessFactor *= dot( texelMetalness, godotMetallicTextureChannel );');
  });
});

describe('the metallic and roughness channel uniforms', () => {
  it("read the masks from the material's userData", () => {
    const userData = metallicRoughnessChannelsUserData(ALPHA, RED);
    const { uniforms } = patchedFor(new THREE.MeshStandardMaterial({ userData }), STANDARD_FRAGMENT);
    expect([
      uniforms.godotRoughnessTextureChannel!.value,
      uniforms.godotMetallicTextureChannel!.value,
    ]).toEqual([ALPHA, RED]);
  });

  it('follow a later change to the userData, so a new channel needs no recompile', () => {
    const material = new THREE.MeshStandardMaterial({
      userData: metallicRoughnessChannelsUserData(RED, RED),
    });
    const { uniforms } = patchedFor(material, STANDARD_FRAGMENT);
    material.userData = metallicRoughnessChannelsUserData(ALPHA, RED);
    expect(uniforms.godotRoughnessTextureChannel!.value).toEqual(ALPHA);
  });

  it("are Godot's red default on a material that records neither (edge case)", () => {
    // `material.cpp:3985-3986`.
    const { uniforms } = patchedFor(new THREE.MeshStandardMaterial(), STANDARD_FRAGMENT);
    expect([
      uniforms.godotRoughnessTextureChannel!.value,
      uniforms.godotMetallicTextureChannel!.value,
    ]).toEqual([RED, RED]);
  });
});
