import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  GODOT_AMBIENT_OCCLUSION,
  OCCLUSION_MIX,
  ambientOcclusionUserData,
  installGodotOcclusion,
} from './godotAmbientOcclusion';
import type { ProgramShader } from '../materialProgramInputs';
import { warningsOf } from '../testing/logWarnings';
import { restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';
import { TextureChannel, textureChannelMask } from '../../godot/rendering/materials/textureChannel';

const AO_INCLUDE = '#include <aomap_fragment>';
const TOTALS = 'vec3 totalDiffuse';
const RED = textureChannelMask(TextureChannel.TEXTURE_CHANNEL_RED);
const STANDARD_FRAGMENT = THREE.ShaderLib.standard.fragmentShader;

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

  it.each(['reflectedLight.directDiffuse *=', 'reflectedLight.directSpecular *='])(
    'scales the direct term `%s` once the indirect one is occluded',
    (statement) => {
      expect(scalesBeforeTotals(patched(fragmentShader, 1).fragmentShader, statement)).toBe(true);
    }
  );

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
    expect(patched(STANDARD_FRAGMENT, 0.5).uniforms.godotAoLightAffect!.value).toBe(0.5);
  });

  it("read the channel mask from the material's userData", () => {
    const green = textureChannelMask(TextureChannel.TEXTURE_CHANNEL_GREEN);
    const material = new THREE.MeshStandardMaterial({ userData: ambientOcclusionUserData(0, green) });
    expect(patchedFor(material, STANDARD_FRAGMENT).uniforms.godotAoTextureChannel!.value).toEqual([
      0, 1, 0, 0,
    ]);
  });

  it('follow a later change to the userData, so a new value needs no recompile', () => {
    const material = new THREE.MeshStandardMaterial({ userData: ambientOcclusionUserData(0, RED) });
    const { uniforms } = patchedFor(material, STANDARD_FRAGMENT);
    material.userData = ambientOcclusionUserData(0.75, RED);
    expect(uniforms.godotAoLightAffect!.value).toBe(0.75);
  });

  it("are Godot's defaults on a material that records neither (edge case)", () => {
    // `material.cpp:3983,3987`: light affect 0, red channel.
    const { uniforms } = patchedFor(new THREE.MeshStandardMaterial(), STANDARD_FRAGMENT);
    expect([uniforms.godotAoLightAffect!.value, uniforms.godotAoTextureChannel!.value]).toEqual([
      0,
      [1, 0, 0, 0],
    ]);
  });
});

describe('installGodotOcclusion', () => {
  restoreShaderGlobalsAfterEach();

  it('declares the decals mix at the identity, ahead of the AO map uniforms', () => {
    installGodotOcclusion();

    expect(
      THREE.ShaderChunk.aomap_pars_fragment.startsWith(`vec2 ${OCCLUSION_MIX} = vec2( 1.0, 0.0 );`)
    ).toBe(true);
  });

  it("runs three's occlusion chunk for a surface with no AO map, from the occlusion 1 (`:1248`)", () => {
    installGodotOcclusion();
    const chunk = THREE.ShaderChunk.aomap_fragment;

    expect(chunk.startsWith('#if 1\n')).toBe(true);
    expect(chunk).toContain('float ambientOcclusion = 1.0;\n\t#ifdef USE_AOMAP\n\t\tambientOcclusion = (');
  });

  it("mixes the decals' ORM into the occlusion before anything scales by it", () => {
    installGodotOcclusion();
    const chunk = THREE.ShaderChunk.aomap_fragment;

    expect(chunk.indexOf(`ambientOcclusion * ${OCCLUSION_MIX}.x + ${OCCLUSION_MIX}.y`)).toBeLessThan(
      chunk.indexOf('reflectedLight.indirectDiffuse *= ambientOcclusion;')
    );
  });

  it.each(
    Object.entries(THREE.ShaderLib).filter(([, shader]) =>
      shader.fragmentShader.includes('#include <aomap_fragment>')
    )
  )('is declared before the %s program includes the chunk that reads it', (_name, shader) => {
    const { fragmentShader } = shader;

    expect(fragmentShader.indexOf('#include <aomap_pars_fragment>')).toBeGreaterThan(-1);
    expect(fragmentShader.indexOf('#include <aomap_pars_fragment>')).toBeLessThan(
      fragmentShader.indexOf('#include <aomap_fragment>')
    );
  });

  it('changes nothing and warns nothing on a second call (edge case)', () => {
    installGodotOcclusion();
    const once = THREE.ShaderChunk.aomap_fragment;

    expect(warningsOf(installGodotOcclusion)).toEqual([]);
    expect(THREE.ShaderChunk.aomap_fragment).toBe(once);
  });

  it('leaves both chunks alone when the sample line is gone, and warns (error case)', () => {
    THREE.ShaderChunk.aomap_fragment = '#ifdef USE_AOMAP\n#endif';

    expect(warningsOf(installGodotOcclusion)).toHaveLength(1);
    expect(THREE.ShaderChunk.aomap_pars_fragment).not.toContain(OCCLUSION_MIX);
  });
});
