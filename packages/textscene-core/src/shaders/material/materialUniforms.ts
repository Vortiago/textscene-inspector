import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { BillboardMode } from '../../godot/rendering/materials/billboardMode.js';
import { DistanceFadeMode } from '../../godot/rendering/materials/distanceFadeMode.js';
import { TextureChannel } from '../../godot/rendering/materials/textureChannel.js';
import { TEXTURE_FILTER_WORDS, TextureFilter } from '../../godot/rendering/materials/textureFilter.js';
import { Transparency } from '../../godot/rendering/materials/transparency.js';
import { MaterialFeature, MaterialFlag } from '../../godot/rendering/materials/materialFeatures.js';
import { isMsdf, usesAlphaAntialiasing, type MaterialKey } from './materialKey.js';

type Filter = EnumValue<typeof TextureFilter>;

/** The heightmap's filter, which reads linear under a nearest filter (`material.cpp:730-760`). */
const HEIGHTMAP_FILTERS: Readonly<Record<Filter, Filter>> = {
  [TextureFilter.NEAREST]: TextureFilter.LINEAR,
  [TextureFilter.LINEAR]: TextureFilter.LINEAR,
  [TextureFilter.NEAREST_WITH_MIPMAPS]: TextureFilter.LINEAR_WITH_MIPMAPS,
  [TextureFilter.LINEAR_WITH_MIPMAPS]: TextureFilter.LINEAR_WITH_MIPMAPS,
  [TextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC]: TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC,
  [TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC]: TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC,
};

/** A filter's sampler hint, or nothing for a value past the enum. */
const filterHint = (filter: Filter | undefined) =>
  filter === undefined || !(filter in TEXTURE_FILTER_WORDS) ? '' : `filter_${TEXTURE_FILTER_WORDS[filter]}`;

const ROUGHNESS_HINTS: Readonly<Record<EnumValue<typeof TextureChannel>, string>> = {
  [TextureChannel.TEXTURE_CHANNEL_RED]: 'hint_roughness_r',
  [TextureChannel.TEXTURE_CHANNEL_GREEN]: 'hint_roughness_g',
  [TextureChannel.TEXTURE_CHANNEL_BLUE]: 'hint_roughness_b',
  [TextureChannel.TEXTURE_CHANNEL_ALPHA]: 'hint_roughness_a',
  [TextureChannel.TEXTURE_CHANNEL_GRAYSCALE]: 'hint_roughness_gray',
};

/** The sampler hints of a texture and of the heightmap: the filter, then the repeat. */
function samplerHints(key: MaterialKey): { texture: string; height: string } {
  const texture = filterHint(key.textureFilter);
  const height = filterHint(HEIGHTMAP_FILTERS[key.textureFilter]);
  const repeat = key.flags.has(MaterialFlag.USE_TEXTURE_REPEAT) ? ', repeat_enable' : ', repeat_disable';
  return { texture: texture + repeat, height: height + repeat };
}

/** The uniforms and varyings Godot declares for the key (`material.cpp:968`). */
export function materialUniforms(key: MaterialKey): string {
  const { flags } = key;
  const hints = samplerHints(key);
  const filter = hints.texture;
  let code = `
uniform vec4 albedo : source_color;
uniform sampler2D texture_albedo : source_color, ${filter};
`;
  if (key.grow) code += 'uniform float grow : hint_range(-16.0, 16.0, 0.001);\n';
  if (key.proximityFade) code += 'uniform float proximity_fade_distance : hint_range(0.0, 4096.0, 0.01);\n';
  if (key.distanceFade !== DistanceFadeMode.DISABLED)
    code += `
uniform float distance_fade_min : hint_range(0.0, 4096.0, 0.01);
uniform float distance_fade_max : hint_range(0.0, 4096.0, 0.01);
`;
  if (isMsdf(key))
    code += `
uniform float msdf_pixel_range : hint_range(1.0, 100.0, 1.0);
uniform float msdf_outline_size : hint_range(0.0, 250.0, 1.0);
`;
  code += alphaUniforms(key);
  code += 'uniform ivec2 albedo_texture_size;\n';
  code += 'uniform float point_size : hint_range(0.1, 128.0, 0.1);\n';
  code += key.orm
    ? `uniform sampler2D texture_orm : hint_roughness_g, ${filter};\n`
    : metallicUniforms(key, filter);
  if (key.billboardMode === BillboardMode.BILLBOARD_PARTICLES)
    code += `
uniform int particles_anim_h_frames : hint_range(1, 128);
uniform int particles_anim_v_frames : hint_range(1, 128);
uniform bool particles_anim_loop;
`;
  code += featureUniforms(key, filter);
  code += layerUniforms(key, filter);
  code += heightmapUniforms(key, hints.height);
  if (flags.has(MaterialFlag.UV1_USE_TRIPLANAR)) code += 'varying vec3 uv1_triplanar_pos;\n';
  if (flags.has(MaterialFlag.UV2_USE_TRIPLANAR)) code += 'varying vec3 uv2_triplanar_pos;\n';
  if (flags.has(MaterialFlag.UV1_USE_TRIPLANAR))
    code += `
uniform float uv1_blend_sharpness : hint_range(0.0, 150.0, 0.001);
varying vec3 uv1_power_normal;
`;
  if (flags.has(MaterialFlag.UV2_USE_TRIPLANAR))
    code += `uniform float uv2_blend_sharpness : hint_range(0.0, 150.0, 0.001);
varying vec3 uv2_power_normal;
`;
  code += `
uniform vec3 uv1_scale;
uniform vec3 uv1_offset;
uniform vec3 uv2_scale;
uniform vec3 uv2_offset;
`;
  if (flags.has(MaterialFlag.USE_Z_CLIP_SCALE))
    code += 'uniform float z_clip_scale : hint_range(0.01, 1.0, 0.01);\n';
  if (flags.has(MaterialFlag.USE_FOV_OVERRIDE))
    code += 'uniform float fov_override : hint_range(1.0, 179.0, 0.1);\n';
  return code;
}

function alphaUniforms(key: MaterialKey): string {
  let code = '';
  if (key.transparency === Transparency.ALPHA_SCISSOR)
    code += 'uniform float alpha_scissor_threshold : hint_range(0.0, 1.0, 0.001);\n';
  else if (key.transparency === Transparency.ALPHA_HASH)
    code += 'uniform float alpha_hash_scale : hint_range(0.0, 2.0, 0.01);\n';
  if (usesAlphaAntialiasing(key))
    code += 'uniform float alpha_antialiasing_edge : hint_range(0.0, 1.0, 0.01);\n';
  return code;
}

function metallicUniforms(key: MaterialKey, filter: string): string {
  const roughnessHint = ROUGHNESS_HINTS[key.roughnessTextureChannel] ?? '';
  return `
uniform float roughness : hint_range(0.0, 1.0);
uniform sampler2D texture_metallic : hint_default_white, ${filter};
uniform vec4 metallic_texture_channel;
uniform sampler2D texture_roughness : ${roughnessHint}, ${filter};

uniform float specular : hint_range(0.0, 1.0, 0.01);
uniform float metallic : hint_range(0.0, 1.0, 0.01);
`;
}

/** The uniforms of each enabled feature, in Godot's order. */
function featureUniforms(key: MaterialKey, filter: string): string {
  const { features } = key;
  let code = '';
  if (features.has(MaterialFeature.EMISSION))
    code += `
uniform sampler2D texture_emission : source_color, hint_default_black, ${filter};
uniform vec4 emission : source_color;
uniform float emission_energy : hint_range(0.0, 100.0, 0.01);
`;
  if (features.has(MaterialFeature.REFRACTION))
    code += `
uniform sampler2D texture_refraction : ${filter};
uniform float refraction : hint_range(-1.0, 1.0, 0.001);
uniform vec4 refraction_texture_channel;
uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_linear_mipmap;
`;
  if (features.has(MaterialFeature.REFRACTION) || key.proximityFade)
    code += 'uniform sampler2D depth_texture : hint_depth_texture, repeat_disable, filter_nearest;\n';
  if (features.has(MaterialFeature.NORMAL_MAPPING))
    code += `
uniform sampler2D texture_normal : hint_roughness_normal, ${filter};
uniform float normal_scale : hint_range(-16.0, 16.0);
`;
  if (features.has(MaterialFeature.BENT_NORMAL_MAPPING))
    code += `
uniform sampler2D texture_bent_normal : hint_roughness_normal, ${filter};
`;
  if (features.has(MaterialFeature.RIM))
    code += `
uniform float rim : hint_range(0.0, 1.0, 0.01);
uniform float rim_tint : hint_range(0.0, 1.0, 0.01);
uniform sampler2D texture_rim : hint_default_white, ${filter};
`;
  if (features.has(MaterialFeature.CLEARCOAT))
    code += `
uniform float clearcoat : hint_range(0.0, 1.0, 0.01);
uniform float clearcoat_roughness : hint_range(0.0, 1.0, 0.01);
uniform sampler2D texture_clearcoat : hint_default_white, ${filter};
`;
  if (features.has(MaterialFeature.ANISOTROPY))
    code += `
uniform float anisotropy_ratio : hint_range(0.0, 1.0, 0.01);
uniform sampler2D texture_flowmap : hint_anisotropy, ${filter};
`;
  if (features.has(MaterialFeature.AMBIENT_OCCLUSION))
    code += `
uniform sampler2D texture_ambient_occlusion : hint_default_white, ${filter};
uniform vec4 ao_texture_channel;
uniform float ao_light_affect : hint_range(0.0, 1.0, 0.01);
`;
  return code;
}

/** The detail layer, subsurface scattering, its transmittance and the backlight. */
function layerUniforms(key: MaterialKey, filter: string): string {
  const { features } = key;
  let code = '';
  if (features.has(MaterialFeature.DETAIL))
    code += `
uniform sampler2D texture_detail_albedo : source_color, ${filter};
uniform sampler2D texture_detail_normal : hint_normal, ${filter};
uniform sampler2D texture_detail_mask : hint_default_white, ${filter};
`;
  if (features.has(MaterialFeature.SUBSURFACE_SCATTERING))
    code += `
uniform float subsurface_scattering_strength : hint_range(0.0, 1.0, 0.01);
uniform sampler2D texture_subsurface_scattering : hint_default_white, ${filter};
`;
  if (features.has(MaterialFeature.SUBSURFACE_TRANSMITTANCE))
    code += `
uniform vec4 transmittance_color : source_color;
uniform float transmittance_depth : hint_range(0.001, 8.0, 0.001);
uniform sampler2D texture_subsurface_transmittance : hint_default_white, ${filter};
uniform float transmittance_boost : hint_range(0.0, 1.0, 0.01);
`;
  if (features.has(MaterialFeature.BACKLIGHT))
    code += `
uniform vec4 backlight : source_color;
uniform sampler2D texture_backlight : hint_default_black, ${filter};
`;
  return code;
}

function heightmapUniforms(key: MaterialKey, heightFilter: string): string {
  if (!key.features.has(MaterialFeature.HEIGHT_MAPPING)) return '';
  return `
uniform sampler2D texture_heightmap : hint_default_black, ${heightFilter};
uniform float heightmap_scale : hint_range(-16.0, 16.0, 0.001);
uniform int heightmap_min_layers : hint_range(1, 64);
uniform int heightmap_max_layers : hint_range(1, 64);
uniform vec2 heightmap_flip;
`;
}
