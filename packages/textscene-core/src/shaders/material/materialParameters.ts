import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { clamp } from '../../godot/math/math.js';
import { TextureChannel, textureChannelMask } from '../../godot/rendering/materials/textureChannel.js';
import {
  BASE_MATERIAL_3D_DEFAULTS as D,
  PROXIMITY_FADE_DISTANCE_MIN,
  TRIPLANAR_SHARPNESS_RANGE,
} from '../../godot/scene/baseMaterial3D.js';
import { bool, real, variant, vector2, vector3, type Variant } from '../../godot/variant/value/variant.js';
import type { MaterialState, MaterialValue } from './materialProperties.js';

/** The value of each property the constructor sets (`material.cpp:3936`), under the property's name. */
const DEFAULTS: Readonly<Record<string, MaterialValue>> = {
  albedo_color: D.albedo,
  metallic_specular: D.specular,
  roughness: D.roughness,
  metallic: D.metallic,
  emission: D.emission,
  emission_energy_multiplier: D.emissionEnergyMultiplier,
  normal_scale: D.normalScale,
  rim: D.rim,
  rim_tint: D.rimTint,
  clearcoat: D.clearcoat,
  clearcoat_roughness: D.clearcoatRoughness,
  anisotropy: D.anisotropy,
  heightmap_scale: D.heightmapScale,
  subsurf_scatter_strength: D.subsurfaceScatteringStrength,
  backlight: D.backlight,
  subsurf_scatter_transmittance_color: D.transmittanceColor,
  subsurf_scatter_transmittance_depth: D.transmittanceDepth,
  subsurf_scatter_transmittance_boost: D.transmittanceBoost,
  refraction_scale: D.refractionScale,
  point_size: D.pointSize,
  uv1_offset: D.uvOffset,
  uv1_scale: D.uvScale,
  uv1_triplanar_sharpness: D.triplanarSharpness,
  uv2_offset: D.uvOffset,
  uv2_scale: D.uvScale,
  uv2_triplanar_sharpness: D.triplanarSharpness,
  particles_anim_h_frames: D.particlesAnimFrames,
  particles_anim_v_frames: D.particlesAnimFrames,
  particles_anim_loop: D.particlesAnimLoop,
  alpha_scissor_threshold: D.alphaScissorThreshold,
  alpha_hash_scale: D.alphaHashScale,
  alpha_antialiasing_edge: D.alphaAntialiasingEdge,
  proximity_fade_distance: D.proximityFadeDistance,
  distance_fade_min_distance: D.distanceFadeMinDistance,
  distance_fade_max_distance: D.distanceFadeMaxDistance,
  ao_light_affect: D.aoLightAffect,
  metallic_texture_channel: TextureChannel.TEXTURE_CHANNEL_RED,
  ao_texture_channel: TextureChannel.TEXTURE_CHANNEL_RED,
  refraction_texture_channel: TextureChannel.TEXTURE_CHANNEL_RED,
  grow_amount: D.growAmount,
  msdf_pixel_range: D.msdfPixelRange,
  msdf_outline_size: D.msdfOutlineSize,
  heightmap_min_layers: D.heightmapMinLayers,
  heightmap_max_layers: D.heightmapMaxLayers,
  heightmap_flip_tangent: D.heightmapFlip,
  heightmap_flip_binormal: D.heightmapFlip,
  z_clip_scale: D.zClipScale,
  fov_override: D.fovOverride,
};

/** The parameters whose value is the property of the same name. */
const SAME_NAME = [
  'roughness',
  'metallic',
  'emission',
  'normal_scale',
  'rim',
  'rim_tint',
  'ao_light_affect',
  'clearcoat',
  'clearcoat_roughness',
  'heightmap_scale',
  'backlight',
  'point_size',
  'uv1_scale',
  'uv1_offset',
  'uv2_scale',
  'uv2_offset',
  'particles_anim_h_frames',
  'particles_anim_v_frames',
  'particles_anim_loop',
  'alpha_scissor_threshold',
  'alpha_hash_scale',
  'alpha_antialiasing_edge',
  'z_clip_scale',
  'fov_override',
  'msdf_pixel_range',
  'msdf_outline_size',
  'heightmap_min_layers',
  'heightmap_max_layers',
];

/** The parameters whose value is a property of another name, by parameter name. */
const RENAMED: readonly (readonly [string, string])[] = Object.entries({
  albedo: 'albedo_color',
  specular: 'metallic_specular',
  emission_energy: 'emission_energy_multiplier',
  anisotropy_ratio: 'anisotropy',
  subsurface_scattering_strength: 'subsurf_scatter_strength',
  transmittance_color: 'subsurf_scatter_transmittance_color',
  transmittance_depth: 'subsurf_scatter_transmittance_depth',
  transmittance_boost: 'subsurf_scatter_transmittance_boost',
  refraction: 'refraction_scale',
  grow: 'grow_amount',
  distance_fade_min: 'distance_fade_min_distance',
  distance_fade_max: 'distance_fade_max_distance',
});

const COPIED = [...SAME_NAME.map((name) => [name, name] as const), ...RENAMED];

/** The texture parameters (`material.cpp:645`), by the property that holds each texture. */
const TEXTURE_PARAMETERS: Readonly<Record<string, string>> = {
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

/** The sampler parameter of the texture property `property`, or nothing for any other property. */
export const textureParameterOf = (property: string): string | undefined => TEXTURE_PARAMETERS[property];

/** The parameter `set_texture` gives the albedo texture's size (`material.cpp:2545`). */
export const ALBEDO_TEXTURE_SIZE = 'albedo_texture_size';

/** The parameters Godot's setters write as a `Color` (`material.cpp:2151-2328`). */
const COLOR_PARAMETERS: ReadonlySet<string> = new Set([
  'albedo',
  'emission',
  'backlight',
  'transmittance_color',
]);

/** The Variant a setter passes for parameter `name`: a lane list is a vector, or a colour. */
function parameterVariant(name: string, value: MaterialValue): Variant {
  if (typeof value === 'boolean') return bool(value);
  if (typeof value === 'number') return real(value);
  const [x = 0, y = 0, z = 0, w = 0] = value;
  if (value.length === 2) return vector2({ x, y });
  if (value.length === 3) return vector3({ x, y, z });
  if (COLOR_PARAMETERS.has(name)) return variant('COLOR', { r: x, g: y, b: z, a: w });
  return variant('VECTOR4', { x, y, z, w });
}

/** The channel mask of the enum property `name`, as `_get_texture_mask` (`material.cpp:2950`) gives it. */
const maskOf = (state: MaterialState, name: string) =>
  textureChannelMask(Number(valueOf(state, name)) as EnumValue<typeof TextureChannel>);

const valueOf = (state: MaterialState, name: string): MaterialValue => state.values[name] ?? DEFAULTS[name]!;

/**
 * The Variant Godot's setters give each parameter but the textures, which `textureParameterOf` names.
 * @canonical Fill a BaseMaterial3D shader's parameters from the material's properties.
 */
export function materialParameters(state: MaterialState): Record<string, Variant> {
  const values: Record<string, MaterialValue> = {};
  for (const [parameter, property] of COPIED) values[parameter] = valueOf(state, property);
  values.metallic_texture_channel = maskOf(state, 'metallic_texture_channel');
  values.ao_texture_channel = maskOf(state, 'ao_texture_channel');
  values.refraction_texture_channel = maskOf(state, 'refraction_texture_channel');
  Object.assign(values, clampedParameters(state));
  values.heightmap_flip = [
    valueOf(state, 'heightmap_flip_tangent') ? -1 : 1,
    valueOf(state, 'heightmap_flip_binormal') ? -1 : 1,
  ];
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, parameterVariant(name, value)])
  );
}

/** The parameters whose setter clamps the property: a sharpness out of range gives NaN weights. */
function clampedParameters(state: MaterialState): Record<string, number> {
  const number = (name: string) => Number(valueOf(state, name));
  const { min, max } = TRIPLANAR_SHARPNESS_RANGE;
  return {
    uv1_blend_sharpness: clamp(number('uv1_triplanar_sharpness'), min, max),
    uv2_blend_sharpness: clamp(number('uv2_triplanar_sharpness'), min, max),
    proximity_fade_distance: Math.max(number('proximity_fade_distance'), PROXIMITY_FADE_DISTANCE_MIN),
  };
}
