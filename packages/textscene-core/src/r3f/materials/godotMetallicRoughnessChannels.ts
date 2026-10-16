/**
 * Godot's metallic and roughness map reads in three's lit programs. three reads roughness from the
 * green channel and metallic from the blue. Godot reads the channels `roughness_texture_channel`
 * and `metallic_texture_channel` name, red by default (`material.cpp:1685`, `:1725`).
 */

import { ShaderChunk, type IUniform, type Material } from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { recordedUniform } from './recordedOnMaterial';
import { applyEdits } from '../shaderPatch/chunkPatch';
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

const ROUGHNESS_READ = {
  three: 'roughnessFactor *= texelRoughness.g;',
  godot: `roughnessFactor *= dot( texelRoughness, ${ROUGHNESS_CHANNEL_KEY} );`,
};
const METALLIC_READ = {
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

/** Written once, by the first compile that patches. The chunks are fixed for one build of three. */
let maskedChunks: { roughness: string; metalness: string } | undefined;

/** Checked at the first compile, so a three whose chunk lost its read fails loudly, not with a wrong channel. */
function maskedReads(): { roughness: string; metalness: string } {
  maskedChunks ??= {
    roughness: masked('roughnessmap_fragment', ROUGHNESS_READ),
    metalness: masked('metalnessmap_fragment', METALLIC_READ),
  };
  return maskedChunks;
}

function masked(
  name: 'roughnessmap_fragment' | 'metalnessmap_fragment',
  read: typeof ROUGHNESS_READ
): string {
  const chunk = ShaderChunk[name];
  const patched = applyEdits(chunk, [read]);
  if (patched === null)
    throw new Error(`expected three's ${name} to hold "${read.three}" once, got:\n${chunk}`);
  return patched;
}

const CHANNEL_UNIFORMS = `${ROUGHNESS_PARS_CHUNK}
uniform vec4 ${ROUGHNESS_CHANNEL_KEY};
uniform vec4 ${METALLIC_CHANNEL_KEY};`;

/** What a lit material with a bound roughness or metallic map compiles with, three's chunks inlined. */
export const GODOT_METALLIC_ROUGHNESS_CHANNELS: ProgramInjection = {
  cacheKey: 'godot-metallic-roughness-channels',
  onBeforeCompile(shader) {
    const { roughness, metalness } = maskedReads();
    Object.assign(shader.uniforms, channelUniforms(this));
    shader.fragmentShader = shader.fragmentShader
      .replace(ROUGHNESS_PARS_CHUNK, CHANNEL_UNIFORMS)
      .replace(ROUGHNESS_CHUNK, roughness)
      .replace(METALNESS_CHUNK, metalness);
  },
};
