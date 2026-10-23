/**
 * Godot's metallic and roughness map reads in three's lit programs. three reads roughness from the
 * green channel and metallic from the blue. Godot reads the channels `roughness_texture_channel`
 * and `metallic_texture_channel` name, red by default (`material.cpp:1685`, `:1725`).
 */

import type { IUniform, Material } from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { recordedUniform } from './recordedOnMaterial';
import { editedChunk, editedProgram, type TextEdit } from '../shaderPatch/chunkPatch';
import {
  DEFAULT_TEXTURE_CHANNEL_MASK,
  type TextureChannelMask,
} from '../../godot/rendering/materials/textureChannel';

const ROUGHNESS_PARS_CHUNK = '#include <roughnessmap_pars_fragment>';
const ROUGHNESS_CHUNK = '#include <roughnessmap_fragment>';
const METALNESS_CHUNK = '#include <metalnessmap_fragment>';

/** The uniforms the patch reads, and the `userData` keys a material records its masks under. */
const ROUGHNESS_CHANNEL_KEY = 'godotRoughnessTextureChannel';
const METALLIC_CHANNEL_KEY = 'godotMetallicTextureChannel';

const ROUGHNESS_READ: TextEdit = {
  three: 'roughnessFactor *= texelRoughness.g;',
  godot: `roughnessFactor *= dot( texelRoughness, ${ROUGHNESS_CHANNEL_KEY} );`,
};
const METALLIC_READ: TextEdit = {
  three: 'metalnessFactor *= texelMetalness.b;',
  godot: `metalnessFactor *= dot( texelMetalness, ${METALLIC_CHANNEL_KEY} );`,
};

/** The `userData` that gives a material its `roughness_texture_channel` and `metallic_texture_channel`. */
export function metallicRoughnessChannelsUserData(
  roughnessMask: TextureChannelMask,
  metallicMask: TextureChannelMask
): Record<string, unknown> {
  return { [ROUGHNESS_CHANNEL_KEY]: roughnessMask, [METALLIC_CHANNEL_KEY]: metallicMask };
}

function channelUniforms(material: Material): Record<string, IUniform> {
  return {
    [ROUGHNESS_CHANNEL_KEY]: recordedUniform(material, ROUGHNESS_CHANNEL_KEY, DEFAULT_TEXTURE_CHANNEL_MASK),
    [METALLIC_CHANNEL_KEY]: recordedUniform(material, METALLIC_CHANNEL_KEY, DEFAULT_TEXTURE_CHANNEL_MASK),
  };
}

const CHANNEL_UNIFORMS = `${ROUGHNESS_PARS_CHUNK}
uniform vec4 ${ROUGHNESS_CHANNEL_KEY};
uniform vec4 ${METALLIC_CHANNEL_KEY};`;

/**
 * What a lit material with a bound roughness or metallic map compiles with. three's chunks are
 * inlined and read at each compile, so they hold the chunks as the shader patches leave them.
 */
export const GODOT_METALLIC_ROUGHNESS_CHANNELS: ProgramInjection = {
  cacheKey: 'godot-metallic-roughness-channels',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, channelUniforms(this));
    editedProgram(
      shader,
      {
        fragment: [
          { three: ROUGHNESS_PARS_CHUNK, godot: CHANNEL_UNIFORMS },
          { three: ROUGHNESS_CHUNK, godot: editedChunk('roughnessmap_fragment', ROUGHNESS_READ) },
          { three: METALNESS_CHUNK, godot: editedChunk('metalnessmap_fragment', METALLIC_READ) },
        ],
      },
      'metallic and roughness channels'
    );
  },
};
