import {
  ALPHA_ANTIALIASING,
  BILLBOARD,
  DISTANCE_FADE,
  TRANSPARENCY,
  type MaterialKey,
} from './materialKey.js';
import { isAlphaTested } from './renderModes.js';

/** Each filter's hint, then the hint of the heightmap, which reads linear under a nearest filter. */
const TEXTURE_FILTERS: readonly (readonly [string, string])[] = [
  ['filter_nearest', 'filter_linear'],
  ['filter_linear', 'filter_linear'],
  ['filter_nearest_mipmap', 'filter_linear_mipmap'],
  ['filter_linear_mipmap', 'filter_linear_mipmap'],
  ['filter_nearest_mipmap_anisotropic', 'filter_linear_mipmap_anisotropic'],
  ['filter_linear_mipmap_anisotropic', 'filter_linear_mipmap_anisotropic'],
];

const ROUGHNESS_HINTS = ['hint_roughness_r', 'hint_roughness_g', 'hint_roughness_b', 'hint_roughness_a'];

/** The sampler hints of a texture and of the heightmap: the filter, then the repeat. */
function samplerHints(key: MaterialKey): { texture: string; height: string } {
  const [texture, height] = TEXTURE_FILTERS[key.textureFilter]!;
  const repeat = key.flags.has('USE_TEXTURE_REPEAT') ? ', repeat_enable' : ', repeat_disable';
  return { texture: texture + repeat, height: height + repeat };
}

/** MSDF albedo takes effect only without UV1 triplanar, which Godot prefers with a warning. */
export const isMsdf = (key: MaterialKey): boolean =>
  key.flags.has('ALBEDO_TEXTURE_MSDF') && !key.flags.has('UV1_USE_TRIPLANAR');

/** The uniforms and varyings Godot declares for the key (`material.cpp:968`). */
export function materialUniforms(key: MaterialKey): string {
  const { flags } = key;
  const filter = samplerHints(key).texture;
  let code = `
uniform vec4 albedo : source_color;
uniform sampler2D texture_albedo : source_color, ${filter};
`;
  if (key.grow) code += 'uniform float grow : hint_range(-16.0, 16.0, 0.001);\n';
  if (key.proximityFade) code += 'uniform float proximity_fade_distance : hint_range(0.0, 4096.0, 0.01);\n';
  if (key.distanceFade !== DISTANCE_FADE.DISABLED)
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
  if (key.billboardMode === BILLBOARD.PARTICLES)
    code += `
uniform int particles_anim_h_frames : hint_range(1, 128);
uniform int particles_anim_v_frames : hint_range(1, 128);
uniform bool particles_anim_loop;
`;
  code += featureUniforms(key, filter);
  if (flags.has('UV1_USE_TRIPLANAR')) code += 'varying vec3 uv1_triplanar_pos;\n';
  if (flags.has('UV2_USE_TRIPLANAR')) code += 'varying vec3 uv2_triplanar_pos;\n';
  if (flags.has('UV1_USE_TRIPLANAR'))
    code += `
uniform float uv1_blend_sharpness : hint_range(0.0, 150.0, 0.001);
varying vec3 uv1_power_normal;
`;
  if (flags.has('UV2_USE_TRIPLANAR'))
    code += `uniform float uv2_blend_sharpness : hint_range(0.0, 150.0, 0.001);
varying vec3 uv2_power_normal;
`;
  code += `
uniform vec3 uv1_scale;
uniform vec3 uv1_offset;
uniform vec3 uv2_scale;
uniform vec3 uv2_offset;
`;
  if (flags.has('USE_Z_CLIP_SCALE')) code += 'uniform float z_clip_scale : hint_range(0.01, 1.0, 0.01);\n';
  if (flags.has('USE_FOV_OVERRIDE')) code += 'uniform float fov_override : hint_range(1.0, 179.0, 0.1);\n';
  return code;
}

function alphaUniforms(key: MaterialKey): string {
  let code = '';
  if (key.transparency === TRANSPARENCY.ALPHA_SCISSOR)
    code += 'uniform float alpha_scissor_threshold : hint_range(0.0, 1.0, 0.001);\n';
  else if (key.transparency === TRANSPARENCY.ALPHA_HASH)
    code += 'uniform float alpha_hash_scale : hint_range(0.0, 2.0, 0.01);\n';
  if (key.alphaAntialiasingMode !== ALPHA_ANTIALIASING.OFF && isAlphaTested(key))
    code += 'uniform float alpha_antialiasing_edge : hint_range(0.0, 1.0, 0.01);\n';
  return code;
}

function metallicUniforms(key: MaterialKey, filter: string): string {
  const roughnessHint = ROUGHNESS_HINTS[key.roughnessTextureChannel] ?? 'hint_roughness_gray';
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
  if (features.has('EMISSION'))
    code += `
uniform sampler2D texture_emission : source_color, hint_default_black, ${filter};
uniform vec4 emission : source_color;
uniform float emission_energy : hint_range(0.0, 100.0, 0.01);
`;
  if (features.has('REFRACTION'))
    code += `
uniform sampler2D texture_refraction : ${filter};
uniform float refraction : hint_range(-1.0, 1.0, 0.001);
uniform vec4 refraction_texture_channel;
`;
  if (features.has('REFRACTION'))
    code += 'uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_linear_mipmap;\n';
  if (features.has('REFRACTION') || key.proximityFade)
    code += 'uniform sampler2D depth_texture : hint_depth_texture, repeat_disable, filter_nearest;\n';
  if (features.has('NORMAL_MAPPING'))
    code += `
uniform sampler2D texture_normal : hint_roughness_normal, ${filter};
uniform float normal_scale : hint_range(-16.0, 16.0);
`;
  if (features.has('BENT_NORMAL_MAPPING'))
    code += `
uniform sampler2D texture_bent_normal : hint_roughness_normal, ${filter};
`;
  if (features.has('RIM'))
    code += `
uniform float rim : hint_range(0.0, 1.0, 0.01);
uniform float rim_tint : hint_range(0.0, 1.0, 0.01);
uniform sampler2D texture_rim : hint_default_white, ${filter};
`;
  if (features.has('CLEARCOAT'))
    code += `
uniform float clearcoat : hint_range(0.0, 1.0, 0.01);
uniform float clearcoat_roughness : hint_range(0.0, 1.0, 0.01);
uniform sampler2D texture_clearcoat : hint_default_white, ${filter};
`;
  if (features.has('ANISOTROPY'))
    code += `
uniform float anisotropy_ratio : hint_range(0.0, 1.0, 0.01);
uniform sampler2D texture_flowmap : hint_anisotropy, ${filter};
`;
  if (features.has('AMBIENT_OCCLUSION'))
    code += `
uniform sampler2D texture_ambient_occlusion : hint_default_white, ${filter};
uniform vec4 ao_texture_channel;
uniform float ao_light_affect : hint_range(0.0, 1.0, 0.01);
`;
  return code + scatteringUniforms(key, filter);
}

function scatteringUniforms(key: MaterialKey, filter: string): string {
  const { features } = key;
  let code = '';
  if (features.has('DETAIL'))
    code += `
uniform sampler2D texture_detail_albedo : source_color, ${filter};
uniform sampler2D texture_detail_normal : hint_normal, ${filter};
uniform sampler2D texture_detail_mask : hint_default_white, ${filter};
`;
  if (features.has('SUBSURFACE_SCATTERING'))
    code += `
uniform float subsurface_scattering_strength : hint_range(0.0, 1.0, 0.01);
uniform sampler2D texture_subsurface_scattering : hint_default_white, ${filter};
`;
  if (features.has('SUBSURFACE_TRANSMITTANCE'))
    code += `
uniform vec4 transmittance_color : source_color;
uniform float transmittance_depth : hint_range(0.001, 8.0, 0.001);
uniform sampler2D texture_subsurface_transmittance : hint_default_white, ${filter};
uniform float transmittance_boost : hint_range(0.0, 1.0, 0.01);
`;
  if (features.has('BACKLIGHT'))
    code += `
uniform vec4 backlight : source_color;
uniform sampler2D texture_backlight : hint_default_black, ${filter};
`;
  if (features.has('HEIGHT_MAPPING'))
    code += `
uniform sampler2D texture_heightmap : hint_default_black, ${samplerHints(key).height};
uniform float heightmap_scale : hint_range(-16.0, 16.0, 0.001);
uniform int heightmap_min_layers : hint_range(1, 64);
uniform int heightmap_max_layers : hint_range(1, 64);
uniform vec2 heightmap_flip;
`;
  return code;
}
