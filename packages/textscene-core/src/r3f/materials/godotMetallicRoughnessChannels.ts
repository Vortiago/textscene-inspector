/**
 * Godot's metallic and roughness map reads in three's lit programs. three reads roughness from the
 * green channel and metallic from the blue. Godot reads the channels `roughness_texture_channel`
 * and `metallic_texture_channel` name, red by default (`material.cpp:1685`, `:1725`).
 */

import { ShaderChunk, type IUniform, type Material } from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import { recordedOn } from './recordedOnMaterial';
import {
  TextureChannel,
  textureChannelMask,
  type TextureChannelMask,
} from '../../godot/rendering/materials/textureChannel';

const ROUGHNESS_PARS_CHUNK = '#include <roughnessmap_pars_fragment>';
const ROUGHNESS_CHUNK = '#include <roughnessmap_fragment>';
const METALNESS_CHUNK = '#include <metalnessmap_fragment>';
const GREEN_READ = 'roughnessFactor *= texelRoughness.g;';
const BLUE_READ = 'metalnessFactor *= texelMetalness.b;';

/** The uniforms the patch reads, and the `userData` keys a material records its masks under. */
const ROUGHNESS_CHANNEL_KEY = 'godotRoughnessTextureChannel';
const METALLIC_CHANNEL_KEY = 'godotMetallicTextureChannel';

/** Both channels' default, red (`material.cpp:3985-3986`). */
const DEFAULT_CHANNEL_MASK = textureChannelMask(TextureChannel.TEXTURE_CHANNEL_RED);

/** The `userData` that gives a material its `roughness_texture_channel` and `metallic_texture_channel`. */
export function metallicRoughnessChannelsUserData(
  roughnessMask: TextureChannelMask,
  metallicMask: TextureChannelMask
): Record<string, unknown> {
  return { [ROUGHNESS_CHANNEL_KEY]: roughnessMask, [METALLIC_CHANNEL_KEY]: metallicMask };
}

/** Uniforms that read `material` at each upload, so a re-parse that changes only a channel needs no remount. */
function channelUniforms(material: Material): Record<string, IUniform> {
  return {
    [ROUGHNESS_CHANNEL_KEY]: {
      get value() {
        return recordedOn(material, ROUGHNESS_CHANNEL_KEY, DEFAULT_CHANNEL_MASK);
      },
    },
    [METALLIC_CHANNEL_KEY]: {
      get value() {
        return recordedOn(material, METALLIC_CHANNEL_KEY, DEFAULT_CHANNEL_MASK);
      },
    },
  };
}

/**
 * `chunk` with `read` swapped for `masked`, inlined, as `onBeforeCompile` sees only the `#include`.
 * Checked at each compile, so a three whose chunk lost the read fails loudly, not with a wrong channel.
 */
function maskedChunk(
  name: 'roughnessmap_fragment' | 'metalnessmap_fragment',
  read: string,
  masked: string
): string {
  const chunk = ShaderChunk[name];
  if (!chunk.includes(read)) throw new Error(`expected three's ${name} to hold "${read}", got:\n${chunk}`);
  return chunk.replace(read, masked);
}

/** What a lit material with a bound roughness or metallic map compiles with. */
export const GODOT_METALLIC_ROUGHNESS_CHANNELS: ProgramInjection = {
  cacheKey: 'godot-metallic-roughness-channels',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, channelUniforms(this));
    shader.fragmentShader = shader.fragmentShader
      .replace(
        ROUGHNESS_PARS_CHUNK,
        `${ROUGHNESS_PARS_CHUNK}\nuniform vec4 ${ROUGHNESS_CHANNEL_KEY};\nuniform vec4 ${METALLIC_CHANNEL_KEY};`
      )
      .replace(
        ROUGHNESS_CHUNK,
        maskedChunk(
          'roughnessmap_fragment',
          GREEN_READ,
          `roughnessFactor *= dot( texelRoughness, ${ROUGHNESS_CHANNEL_KEY} );`
        )
      )
      .replace(
        METALNESS_CHUNK,
        maskedChunk(
          'metalnessmap_fragment',
          BLUE_READ,
          `metalnessFactor *= dot( texelMetalness, ${METALLIC_CHANNEL_KEY} );`
        )
      );
  },
};
