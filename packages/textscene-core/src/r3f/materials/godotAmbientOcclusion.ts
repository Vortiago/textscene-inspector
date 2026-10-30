/**
 * Godot's ambient occlusion in three's lit programs. three's `aoMap` reads the red channel and
 * occludes indirect light only. Godot reads the channel `ao_texture_channel` names
 * (`material.cpp:1952`), and also scales the direct light by `mix(1.0, ao, ao_light_affect)`
 * (`scene_forward_clustered.glsl:2213,2944-2945`).
 */

import type { IUniform, Material } from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { BASE_MATERIAL_3D_DEFAULTS } from '../../godot/scene/baseMaterial3D';
import { recordedUniform } from './recordedOnMaterial';
import { editedChunk, editedProgram, installChunkEdits, type TextEdit } from '../shaderPatch/chunkPatch';
import {
  DEFAULT_TEXTURE_CHANNEL_MASK,
  type TextureChannelMask,
} from '../../godot/rendering/materials/textureChannel';

const AO_PARS_CHUNK = '#include <aomap_pars_fragment>';
const AO_CHUNK = '#include <aomap_fragment>';

/**
 * The global that holds the mix of the surface's decals into its occlusion: `ao` becomes
 * `ao * x + y`, which composes every ORM mix of the decals (`scene_forward_clustered.glsl:1634`)
 * whatever `ao` the surface started from. The decals write it, and it reads `(1, 0)` otherwise.
 */
export const OCCLUSION_MIX = 'godotOcclusionMix';

const THREE_AO_GATE = '#ifdef USE_AOMAP';
const THREE_AO_SAMPLE =
  'float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;';

/** Godot's `ao` before the surface's own terms read it: 1 where there is no AO map (`:1248`). */
const GODOT_AO_SAMPLE = `float ambientOcclusion = 1.0;
	#ifdef USE_AOMAP
		ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	#endif
	ambientOcclusion = ambientOcclusion * ${OCCLUSION_MIX}.x + ${OCCLUSION_MIX}.y;`;

/**
 * Makes `ambientOcclusion` exist for every surface, with the decals' ORM mix in it, as Godot's `ao`
 * does. three scales the indirect light by it only for a surface with an AO map. At 1 each
 * statement of the chunk multiplies by exactly 1, so a surface with no AO map and no decal draws
 * the same bits. True when the chunks hold the edit. A second call changes nothing.
 */
export function installGodotOcclusion(): boolean {
  return installChunkEdits({
    edits: [
      {
        chunk: 'aomap_pars_fragment',
        three: THREE_AO_GATE,
        godot: `vec2 ${OCCLUSION_MIX} = vec2( 1.0, 0.0 );\n${THREE_AO_GATE}`,
      },
      { chunk: 'aomap_fragment', three: THREE_AO_GATE, godot: '#if 1' },
      { chunk: 'aomap_fragment', three: THREE_AO_SAMPLE, godot: GODOT_AO_SAMPLE },
    ],
    mark: OCCLUSION_MIX,
    patch: 'occlusion',
  });
}

const MASKED_SAMPLE: TextEdit = {
  three: 'texture2D( aoMap, vAoMapUv ).r',
  godot: 'dot( texture2D( aoMap, vAoMapUv ), godotAoTextureChannel )',
};

/**
 * Sheen carries Godot's rim, which Godot adds to the diffuse light, and clearcoat goes to the
 * specular light (`scene_forward_lights_inc.glsl:163,185`), so both take the direct factor too.
 */
const DIRECT_OCCLUSION = /* glsl */ `
	float godotDirectOcclusion = mix( 1.0, ambientOcclusion, godotAoLightAffect );
	reflectedLight.directDiffuse *= godotDirectOcclusion;
	reflectedLight.directSpecular *= godotDirectOcclusion;
	#ifdef USE_CLEARCOAT
		clearcoatSpecularDirect *= godotDirectOcclusion;
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect *= godotDirectOcclusion;
	#endif
`;

/**
 * three's AO chunk inlined, as `onBeforeCompile` sees only the `#include`, with the channel mask
 * in place of the red sample, and the direct occlusion after it. Read at each compile, so it holds
 * the chunk as the shader patches leave it.
 */
function godotAoFragment(): string {
  return `${editedChunk('aomap_fragment', MASKED_SAMPLE)}${DIRECT_OCCLUSION}`;
}

const GODOT_AO_PARS = `${AO_PARS_CHUNK}
uniform float godotAoLightAffect;
uniform vec4 godotAoTextureChannel;`;

/** Where a material records its `ao_light_affect`. */
const LIGHT_AFFECT_KEY = 'godotAoLightAffect';
/** Where a material records its `ao_texture_channel` mask. */
const CHANNEL_MASK_KEY = 'godotAoTextureChannel';

/** The `userData` that gives a material its `ao_light_affect` and `ao_texture_channel`. */
export function ambientOcclusionUserData(
  lightAffect: number,
  channelMask: TextureChannelMask
): Record<string, unknown> {
  return { [LIGHT_AFFECT_KEY]: lightAffect, [CHANNEL_MASK_KEY]: channelMask };
}

function ambientOcclusionUniforms(material: Material): Record<string, IUniform> {
  return {
    godotAoLightAffect: recordedUniform(material, LIGHT_AFFECT_KEY, BASE_MATERIAL_3D_DEFAULTS.aoLightAffect),
    godotAoTextureChannel: recordedUniform(material, CHANNEL_MASK_KEY, DEFAULT_TEXTURE_CHANNEL_MASK),
  };
}

/** What a lit material with a bound AO map, or with an `ao_light_affect` above 0, compiles with. */
export const GODOT_AMBIENT_OCCLUSION: ProgramInjection = {
  cacheKey: 'godot-ambient-occlusion',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, ambientOcclusionUniforms(this));
    editedProgram(
      shader,
      {
        fragment: [
          { three: AO_PARS_CHUNK, godot: GODOT_AO_PARS },
          { three: AO_CHUNK, godot: godotAoFragment() },
        ],
      },
      'ambient occlusion'
    );
  },
};
