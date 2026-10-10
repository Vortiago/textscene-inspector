/**
 * Godot's ambient occlusion in three's lit programs. three's `aoMap` reads the red channel and
 * occludes indirect light only. Godot reads the channel `ao_texture_channel` names
 * (`material.cpp:1952`), and also scales the direct light by `mix(1.0, ao, ao_light_affect)`
 * (`scene_forward_clustered.glsl:2213,2944-2945`).
 */

import { ShaderChunk, type IUniform, type Material } from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { TextureChannel, textureChannelMask, type TextureChannelMask } from '../../godot/textureChannel';

const AO_PARS_CHUNK = '#include <aomap_pars_fragment>';
const AO_CHUNK = '#include <aomap_fragment>';
const RED_SAMPLE = 'texture2D( aoMap, vAoMapUv ).r';

/**
 * Sheen carries Godot's rim, which Godot adds to the diffuse light, and clearcoat goes to the
 * specular light (`scene_forward_lights_inc.glsl:163,185`), so both take the direct factor too.
 */
const DIRECT_OCCLUSION = /* glsl */ `
#ifdef USE_AOMAP
	float godotDirectOcclusion = mix( 1.0, ambientOcclusion, godotAoLightAffect );
	reflectedLight.directDiffuse *= godotDirectOcclusion;
	reflectedLight.directSpecular *= godotDirectOcclusion;
	#ifdef USE_CLEARCOAT
		clearcoatSpecularDirect *= godotDirectOcclusion;
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect *= godotDirectOcclusion;
	#endif
#endif
`;

/**
 * three's AO chunk inlined, as `onBeforeCompile` sees only the `#include`, with the channel mask
 * in place of the red sample, and the direct occlusion after it.
 */
const GODOT_AO_FRAGMENT = `${ShaderChunk.aomap_fragment.replace(
  RED_SAMPLE,
  'dot( texture2D( aoMap, vAoMapUv ), godotAoTextureChannel )'
)}${DIRECT_OCCLUSION}`;

const GODOT_AO_PARS = `${AO_PARS_CHUNK}
uniform float godotAoLightAffect;
uniform vec4 godotAoTextureChannel;`;

/** Where a material records its `ao_light_affect` and its `ao_texture_channel` mask. */
const LIGHT_AFFECT_KEY = 'godotAoLightAffect';
const CHANNEL_MASK_KEY = 'godotAoTextureChannel';

/** The defaults `material.cpp:3983,3987` sets. */
const DEFAULT_LIGHT_AFFECT = 0;
const DEFAULT_CHANNEL_MASK = textureChannelMask(TextureChannel.TEXTURE_CHANNEL_RED);

/** The `userData` that gives a material its `ao_light_affect` and `ao_texture_channel`. */
export function ambientOcclusionUserData(
  lightAffect: number,
  channelMask: TextureChannelMask
): Record<string, unknown> {
  return { [LIGHT_AFFECT_KEY]: lightAffect, [CHANNEL_MASK_KEY]: channelMask };
}

function recorded<T>(material: Material, key: string, fallback: T): T {
  return (material.userData[key] as T | undefined) ?? fallback;
}

/** Uniforms that read `material` at each upload, so a re-parse that changes only a value needs no remount. */
function ambientOcclusionUniforms(material: Material): Record<string, IUniform> {
  return {
    godotAoLightAffect: {
      get value() {
        return recorded(material, LIGHT_AFFECT_KEY, DEFAULT_LIGHT_AFFECT);
      },
    },
    godotAoTextureChannel: {
      get value() {
        return recorded(material, CHANNEL_MASK_KEY, DEFAULT_CHANNEL_MASK);
      },
    },
  };
}

/** What a lit material with a bound AO map compiles with. */
export const GODOT_AMBIENT_OCCLUSION: ProgramInjection = {
  cacheKey: 'godot-ambient-occlusion',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, ambientOcclusionUniforms(this));
    shader.fragmentShader = shader.fragmentShader
      .replace(AO_PARS_CHUNK, GODOT_AO_PARS)
      .replace(AO_CHUNK, GODOT_AO_FRAGMENT);
  },
};
