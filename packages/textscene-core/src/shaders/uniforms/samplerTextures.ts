import type { UniformHint, UniformNode } from '../language/shaderTree.js';

/** A texture the renderer holds for a sampler that has no material texture, or none at all. */
export type DefaultTexture = 'white' | 'black' | 'transparent' | 'normal' | 'anisotropy' | 'none';

/** The RGBA8 texel of each default, every texel of a 4 by 4 texture (`texture_storage.cpp:85`). */
export const DEFAULT_TEXELS: Readonly<Record<Exclude<DefaultTexture, 'none'>, readonly number[]>> = {
  white: [255, 255, 255, 255],
  black: [0, 0, 0, 255],
  transparent: [0, 0, 0, 0],
  normal: [128, 128, 255, 255],
  anisotropy: [255, 128, 255, 255],
};

/** A sampler's filter and repeat words, as `_get_sampler_name` resolves them. */
export interface SamplerSettings {
  readonly filter: string;
  readonly repeat: string;
}

/** Each shader type's `actions.default_filter` and `default_repeat`, for a uniform that names neither. */
export const SAMPLER_DEFAULTS: Readonly<Record<string, SamplerSettings>> = {
  spatial: { filter: 'filter_linear_mipmap', repeat: 'repeat_enable' },
  sky: { filter: 'filter_linear_mipmap', repeat: 'repeat_enable' },
  particles: { filter: 'filter_linear_mipmap', repeat: 'repeat_enable' },
  fog: { filter: 'filter_linear_mipmap', repeat: 'repeat_disable' },
  canvas_item: { filter: 'filter_linear', repeat: 'repeat_disable' },
};

/** `_get_sampler_name` (`shader_compiler.cpp:277`): a word the uniform leaves out comes from `defaults`. */
export const samplerSettings = (uniform: UniformNode, defaults: SamplerSettings): SamplerSettings => ({
  filter: uniform.filter ?? defaults.filter,
  repeat: uniform.repeat ?? defaults.repeat,
});

/** The 2D defaults by hint; a hint not named here reads white (`material_storage.cpp:969`). */
const FLAT_DEFAULTS: Readonly<Partial<Record<UniformHint, DefaultTexture>>> = {
  hint_default_black: 'black',
  hint_default_transparent: 'transparent',
  hint_anisotropy: 'anisotropy',
  hint_normal: 'normal',
  hint_roughness_normal: 'normal',
};

/** A cube, a 3D texture and a 2D array have black, transparent and white only. */
const VOLUME_DEFAULTS: Readonly<Partial<Record<UniformHint, DefaultTexture>>> = {
  hint_default_black: 'black',
  hint_default_transparent: 'transparent',
};

/** The texture a sampler of `uniform`'s type and hint reads when the material gives none (:964-1050). */
function defaultTexture({ type, hint }: UniformNode): DefaultTexture {
  if (type === 'samplerExternalOES') return 'none';
  // Godot keeps black as the cube array default, which had no other texture before.
  if (type === 'samplerCubeArray')
    return hint === 'hint_default_white' ? 'white' : (VOLUME_DEFAULTS[hint] ?? 'black');
  const isFlat = type.endsWith('sampler2D');
  return (isFlat ? FLAT_DEFAULTS : VOLUME_DEFAULTS)[hint] ?? 'white';
}

/**
 * `update_textures` (`material_storage.cpp:880`): each texture a sampler reads, the material's
 * value standing for nothing set. A null or an element the material array does not reach reads white.
 */
export function samplerTextures<T>(
  uniform: UniformNode,
  value: T | readonly (T | null)[] | null | undefined
): (T | DefaultTexture)[] {
  const arraySize = uniform.arraySize ?? 0;
  const textures = materialTextures(value, arraySize);
  if (textures.length === 0)
    return new Array<DefaultTexture>(Math.max(1, arraySize)).fill(defaultTexture(uniform));
  const padded = [...textures, ...new Array<null>(Math.max(0, arraySize - textures.length)).fill(null)];
  return padded.map((texture) => texture ?? 'white');
}

function materialTextures<T>(
  value: T | readonly (T | null)[] | null | undefined,
  arraySize: number
): (T | null)[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [value as T | null];
  const textures = value as readonly (T | null)[];
  return textures.slice(0, arraySize > 0 ? arraySize : 1);
}
