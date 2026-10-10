import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GODOT_AMBIENT_OCCLUSION, ambientOcclusionUserData } from './godotAmbientOcclusion';
import type { ProgramShader } from '../materialProgramInputs';
import { TextureChannel, textureChannelMask } from '../../godot/textureChannel';

const AO_INCLUDE = '#include <aomap_fragment>';
const TOTALS = 'vec3 totalDiffuse';
const RED = textureChannelMask(TextureChannel.TEXTURE_CHANNEL_RED);

/** The shader `GODOT_AMBIENT_OCCLUSION` leaves for `material`. */
function patchedFor(material: THREE.Material, fragmentShader: string): ProgramShader {
  const shader: ProgramShader = { vertexShader: '', fragmentShader, uniforms: {} };
  GODOT_AMBIENT_OCCLUSION.onBeforeCompile.call(material, shader);
  return shader;
}

/** The shader for a material with this light affect, reading the red channel. */
function patched(fragmentShader: string, lightAffect: number): ProgramShader {
  return patchedFor(
    new THREE.MeshStandardMaterial({ userData: ambientOcclusionUserData(lightAffect, RED) }),
    fragmentShader
  );
}

/** Whether `statement` sits where three's AO chunk sat, before the direct terms are summed. */
function scalesBeforeTotals(fragmentShader: string, statement: string): boolean {
  const at = fragmentShader.indexOf(statement);
  return (
    at > fragmentShader.indexOf('reflectedLight.indirectDiffuse *=') && at < fragmentShader.indexOf(TOTALS)
  );
}

describe.each([
  ['MeshStandardMaterial', THREE.ShaderLib.standard.fragmentShader],
  ['MeshPhysicalMaterial', THREE.ShaderLib.physical.fragmentShader],
])('GODOT_AMBIENT_OCCLUSION on the %s fragment shader', (_type, fragmentShader) => {
  it("replaces three's AO chunk with Godot's", () => {
    expect(patched(fragmentShader, 1).fragmentShader).not.toContain(AO_INCLUDE);
  });

  it('samples the map through the channel mask, not its red channel alone', () => {
    // `material.cpp:1952`.
    expect(patched(fragmentShader, 1).fragmentShader).toContain(
      'dot( texture2D( aoMap, vAoMapUv ), godotAoTextureChannel )'
    );
  });

  it('scales the direct diffuse term once the indirect one is occluded', () => {
    expect(
      scalesBeforeTotals(patched(fragmentShader, 1).fragmentShader, 'reflectedLight.directDiffuse *=')
    ).toBe(true);
  });

  it('scales the direct specular term once the indirect one is occluded', () => {
    expect(
      scalesBeforeTotals(patched(fragmentShader, 1).fragmentShader, 'reflectedLight.directSpecular *=')
    ).toBe(true);
  });

  it("mixes from 1 toward the map's occlusion by the light affect", () => {
    // `scene_forward_clustered.glsl:2213`.
    expect(patched(fragmentShader, 1).fragmentShader).toContain(
      'mix( 1.0, ambientOcclusion, godotAoLightAffect )'
    );
  });
});

describe('GODOT_AMBIENT_OCCLUSION on the MeshPhysicalMaterial fragment shader', () => {
  const { fragmentShader } = patched(THREE.ShaderLib.physical.fragmentShader, 1);

  it('scales the direct sheen term, which carries the rim Godot adds to the diffuse light', () => {
    // `scene_forward_lights_inc.glsl:163`.
    expect(scalesBeforeTotals(fragmentShader, 'sheenSpecularDirect *=')).toBe(true);
  });

  it('scales the direct clearcoat term, which Godot adds to the specular light', () => {
    // `scene_forward_lights_inc.glsl:185`.
    expect(scalesBeforeTotals(fragmentShader, 'clearcoatSpecularDirect *=')).toBe(true);
  });
});

describe('the AO uniforms', () => {
  it("read the light affect from the material's userData", () => {
    expect(patched('', 0.5).uniforms.godotAoLightAffect!.value).toBe(0.5);
  });

  it("read the channel mask from the material's userData", () => {
    const green = textureChannelMask(TextureChannel.TEXTURE_CHANNEL_GREEN);
    const material = new THREE.MeshStandardMaterial({ userData: ambientOcclusionUserData(0, green) });
    expect(patchedFor(material, '').uniforms.godotAoTextureChannel!.value).toEqual([0, 1, 0, 0]);
  });

  it('follow a later change to the userData, so a new value needs no recompile', () => {
    const material = new THREE.MeshStandardMaterial({ userData: ambientOcclusionUserData(0, RED) });
    const { uniforms } = patchedFor(material, '');
    material.userData = ambientOcclusionUserData(0.75, RED);
    expect(uniforms.godotAoLightAffect!.value).toBe(0.75);
  });

  it("are Godot's defaults on a material that records neither (edge case)", () => {
    // `material.cpp:3983,3987`: light affect 0, red channel.
    const { uniforms } = patchedFor(new THREE.MeshStandardMaterial(), '');
    expect([uniforms.godotAoLightAffect!.value, uniforms.godotAoTextureChannel!.value]).toEqual([
      0,
      [1, 0, 0, 0],
    ]);
  });
});
