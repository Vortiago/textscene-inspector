import type { MaterialState, MaterialTexture, MaterialValue } from './materialProperties.js';

/** A shader parameter's value: a bool, a number, a vector's lanes, or a texture. */
export type ParameterValue = boolean | number | readonly number[] | MaterialTexture;

/** The value of each property the constructor sets (`material.cpp:3936`), under the property's name. */
const DEFAULTS: Readonly<Record<string, ParameterValue>> = {
  albedo_color: [1, 1, 1, 1],
  metallic_specular: 0.5,
  roughness: 1,
  metallic: 0,
  emission: [0, 0, 0, 1],
  emission_energy_multiplier: 1,
  normal_scale: 1,
  rim: 1,
  rim_tint: 0.5,
  clearcoat: 1,
  clearcoat_roughness: 0.5,
  anisotropy: 0,
  heightmap_scale: 5,
  subsurf_scatter_strength: 0,
  backlight: [0, 0, 0, 1],
  subsurf_scatter_transmittance_color: [1, 1, 1, 1],
  subsurf_scatter_transmittance_depth: 0.1,
  subsurf_scatter_transmittance_boost: 0,
  refraction_scale: 0.05,
  point_size: 1,
  uv1_offset: [0, 0, 0],
  uv1_scale: [1, 1, 1],
  uv1_triplanar_sharpness: 1,
  uv2_offset: [0, 0, 0],
  uv2_scale: [1, 1, 1],
  uv2_triplanar_sharpness: 1,
  particles_anim_h_frames: 1,
  particles_anim_v_frames: 1,
  particles_anim_loop: false,
  alpha_scissor_threshold: 0.5,
  alpha_hash_scale: 1,
  alpha_antialiasing_edge: 0.3,
  proximity_fade_distance: 1,
  distance_fade_min_distance: 0,
  distance_fade_max_distance: 10,
  ao_light_affect: 0,
  metallic_texture_channel: 0,
  ao_texture_channel: 0,
  refraction_texture_channel: 0,
  grow_amount: 0,
  msdf_pixel_range: 4,
  msdf_outline_size: 0,
  heightmap_min_layers: 8,
  heightmap_max_layers: 32,
  heightmap_flip_tangent: false,
  heightmap_flip_binormal: false,
  z_clip_scale: 1,
  fov_override: 75,
};

/** The parameters whose value is the property's value, by parameter name. */
const COPIED: Readonly<Record<string, string>> = {
  albedo: 'albedo_color',
  specular: 'metallic_specular',
  roughness: 'roughness',
  metallic: 'metallic',
  emission: 'emission',
  emission_energy: 'emission_energy_multiplier',
  normal_scale: 'normal_scale',
  rim: 'rim',
  rim_tint: 'rim_tint',
  ao_light_affect: 'ao_light_affect',
  clearcoat: 'clearcoat',
  clearcoat_roughness: 'clearcoat_roughness',
  anisotropy_ratio: 'anisotropy',
  heightmap_scale: 'heightmap_scale',
  subsurface_scattering_strength: 'subsurf_scatter_strength',
  transmittance_color: 'subsurf_scatter_transmittance_color',
  transmittance_depth: 'subsurf_scatter_transmittance_depth',
  transmittance_boost: 'subsurf_scatter_transmittance_boost',
  backlight: 'backlight',
  refraction: 'refraction_scale',
  point_size: 'point_size',
  uv1_scale: 'uv1_scale',
  uv1_offset: 'uv1_offset',
  uv2_scale: 'uv2_scale',
  uv2_offset: 'uv2_offset',
  particles_anim_h_frames: 'particles_anim_h_frames',
  particles_anim_v_frames: 'particles_anim_v_frames',
  particles_anim_loop: 'particles_anim_loop',
  alpha_scissor_threshold: 'alpha_scissor_threshold',
  alpha_hash_scale: 'alpha_hash_scale',
  alpha_antialiasing_edge: 'alpha_antialiasing_edge',
  grow: 'grow_amount',
  z_clip_scale: 'z_clip_scale',
  fov_override: 'fov_override',
  msdf_pixel_range: 'msdf_pixel_range',
  msdf_outline_size: 'msdf_outline_size',
  distance_fade_min: 'distance_fade_min_distance',
  distance_fade_max: 'distance_fade_max_distance',
  heightmap_min_layers: 'heightmap_min_layers',
  heightmap_max_layers: 'heightmap_max_layers',
};

/** The texture parameters (`material.cpp:645`), by the property that holds each texture. */
const TEXTURES: Readonly<Record<string, string>> = {
  albedo_texture: 'texture_albedo',
  metallic_texture: 'texture_metallic',
  roughness_texture: 'texture_roughness',
  emission_texture: 'texture_emission',
  normal_texture: 'texture_normal',
  bent_normal_texture: 'texture_bent_normal',
  rim_texture: 'texture_rim',
  clearcoat_texture: 'texture_clearcoat',
  anisotropy_flowmap: 'texture_flowmap',
  ao_texture: 'texture_ambient_occlusion',
  heightmap_texture: 'texture_heightmap',
  subsurf_scatter_texture: 'texture_subsurface_scattering',
  subsurf_scatter_transmittance_texture: 'texture_subsurface_transmittance',
  backlight_texture: 'texture_backlight',
  refraction_texture: 'texture_refraction',
  detail_mask: 'texture_detail_mask',
  detail_albedo: 'texture_detail_albedo',
  detail_normal: 'texture_detail_normal',
  orm_texture: 'texture_orm',
};

/** `_get_texture_mask` (`material.cpp:2950`): the lanes a channel's `dot` keeps. */
const CHANNEL_MASKS: readonly (readonly number[])[] = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
  [0.3333333, 0.3333333, 0.3333333, 0],
];

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/**
 * The value of each shader parameter Godot's setters give a material in state `state`.
 * @canonical Fill a BaseMaterial3D shader's parameters from the material's properties.
 */
export function materialParameters(state: MaterialState): Record<string, ParameterValue> {
  const value = (name: string): MaterialValue => state.values[name] ?? DEFAULTS[name]!;
  const number = (name: string) => Number(value(name));
  const parameters: Record<string, ParameterValue> = {};
  for (const [parameter, property] of Object.entries(COPIED)) parameters[parameter] = value(property);
  for (const [property, parameter] of Object.entries(TEXTURES)) {
    const texture = state.values[property];
    if (texture !== undefined) parameters[parameter] = texture;
  }
  const albedo = state.values.albedo_texture as MaterialTexture | undefined;
  if (albedo) parameters.albedo_texture_size = [albedo.width, albedo.height];
  parameters.metallic_texture_channel = CHANNEL_MASKS[number('metallic_texture_channel')]!;
  parameters.ao_texture_channel = CHANNEL_MASKS[number('ao_texture_channel')]!;
  parameters.refraction_texture_channel = CHANNEL_MASKS[number('refraction_texture_channel')]!;
  // A sharpness below 0 or above 150 gives NaN weights (`material.cpp:2785`).
  parameters.uv1_blend_sharpness = clamp(number('uv1_triplanar_sharpness'), 0, 150);
  parameters.uv2_blend_sharpness = clamp(number('uv2_triplanar_sharpness'), 0, 150);
  parameters.proximity_fade_distance = Math.max(number('proximity_fade_distance'), 0.01);
  parameters.heightmap_flip = [
    value('heightmap_flip_tangent') ? -1 : 1,
    value('heightmap_flip_binormal') ? -1 : 1,
  ];
  return parameters;
}
