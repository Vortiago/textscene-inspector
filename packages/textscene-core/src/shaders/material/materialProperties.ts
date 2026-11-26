import type { EnumValue } from '../../godot/classdb/enumNames.js';
import {
  StencilCompare,
  StencilFlag,
  stencilFlagsAfterSet,
  StencilMode,
} from '../../godot/rendering/materials/stencil.js';
import { TextureChannel } from '../../godot/rendering/materials/textureChannel.js';
import { MaterialFeature, MaterialFlag } from '../../godot/rendering/materials/materialFeatures.js';
import { doubleToInt32 } from '../../godot/variant/cInteger.js';
import { defaultKey, type Feature, type Flag, type MaterialKey } from './materialKey.js';

/** A property value: a bool, an enum index or a number, or a colour or vector as lanes. */
export type MaterialValue = boolean | number | readonly number[];

/** A material's properties under Godot's names, in the order Godot's setters ran. */
export type MaterialSettings = Readonly<Record<string, MaterialValue>>;

/** A material's class: ORMMaterial3D sets the `orm` bit of Godot's material key. */
export type MaterialClass = 'StandardMaterial3D' | 'ORMMaterial3D';

/** A material as Godot's setters leave it: the key the text reads, and every other property's value. */
export interface MaterialState {
  readonly key: MaterialKey;
  readonly values: Readonly<Record<string, MaterialValue>>;
}

type KeySetter = (key: MaterialKey, value: MaterialValue) => void;

/** A setter's `bool`: `booleanize` is true for any number but zero, NaN too (`variant_op.cpp:1120`). */
export const setterBool = (value: MaterialValue): boolean =>
  typeof value === 'number' ? value !== 0 : Boolean(value);

/** A setter's `int` or enum: the Variant casts a float to int32 (`variant.h:370`). */
export const setterInt = (value: MaterialValue): number => doubleToInt32(Number(value));

const FEATURES: Readonly<Record<string, Feature>> = {
  emission_enabled: MaterialFeature.EMISSION,
  normal_enabled: MaterialFeature.NORMAL_MAPPING,
  bent_normal_enabled: MaterialFeature.BENT_NORMAL_MAPPING,
  rim_enabled: MaterialFeature.RIM,
  clearcoat_enabled: MaterialFeature.CLEARCOAT,
  anisotropy_enabled: MaterialFeature.ANISOTROPY,
  ao_enabled: MaterialFeature.AMBIENT_OCCLUSION,
  heightmap_enabled: MaterialFeature.HEIGHT_MAPPING,
  subsurf_scatter_enabled: MaterialFeature.SUBSURFACE_SCATTERING,
  subsurf_scatter_transmittance_enabled: MaterialFeature.SUBSURFACE_TRANSMITTANCE,
  backlight_enabled: MaterialFeature.BACKLIGHT,
  refraction_enabled: MaterialFeature.REFRACTION,
  detail_enabled: MaterialFeature.DETAIL,
};

const FLAGS: Readonly<Record<string, Flag>> = {
  no_depth_test: MaterialFlag.DISABLE_DEPTH_TEST,
  disable_ambient_light: MaterialFlag.DISABLE_AMBIENT_LIGHT,
  disable_fog: MaterialFlag.DISABLE_FOG,
  disable_specular_occlusion: MaterialFlag.DISABLE_SPECULAR_OCCLUSION,
  vertex_color_use_as_albedo: MaterialFlag.ALBEDO_FROM_VERTEX_COLOR,
  vertex_color_is_srgb: MaterialFlag.SRGB_VERTEX_COLOR,
  albedo_texture_force_srgb: MaterialFlag.ALBEDO_TEXTURE_FORCE_SRGB,
  albedo_texture_msdf: MaterialFlag.ALBEDO_TEXTURE_MSDF,
  emission_on_uv2: MaterialFlag.EMISSION_ON_UV2,
  ao_on_uv2: MaterialFlag.AO_ON_UV2,
  heightmap_flip_texture: MaterialFlag.INVERT_HEIGHTMAP,
  subsurf_scatter_skin_mode: MaterialFlag.SUBSURFACE_MODE_SKIN,
  uv1_triplanar: MaterialFlag.UV1_USE_TRIPLANAR,
  uv1_world_triplanar: MaterialFlag.UV1_USE_WORLD_TRIPLANAR,
  uv2_triplanar: MaterialFlag.UV2_USE_TRIPLANAR,
  uv2_world_triplanar: MaterialFlag.UV2_USE_WORLD_TRIPLANAR,
  texture_repeat: MaterialFlag.USE_TEXTURE_REPEAT,
  disable_receive_shadows: MaterialFlag.DONT_RECEIVE_SHADOWS,
  shadow_to_opacity: MaterialFlag.USE_SHADOW_TO_OPACITY,
  billboard_keep_scale: MaterialFlag.BILLBOARD_KEEP_SCALE,
  fixed_size: MaterialFlag.FIXED_SIZE,
  use_point_size: MaterialFlag.USE_POINT_SIZE,
  use_particle_trails: MaterialFlag.PARTICLE_TRAILS_MODE,
  use_z_clip_scale: MaterialFlag.USE_Z_CLIP_SCALE,
  use_fov_override: MaterialFlag.USE_FOV_OVERRIDE,
};

type NumberMember = {
  [Member in keyof MaterialKey]: MaterialKey[Member] extends number ? Member : never;
}[keyof MaterialKey];

type BooleanMember = {
  [Member in keyof MaterialKey]: MaterialKey[Member] extends boolean ? Member : never;
}[keyof MaterialKey];

/** The enum and integer properties whose setter only stores the value, by the key member each one sets. */
const NUMBERS: Readonly<Record<string, NumberMember>> = {
  transparency: 'transparency',
  alpha_antialiasing_mode: 'alphaAntialiasingMode',
  blend_mode: 'blendMode',
  cull_mode: 'cullMode',
  depth_draw_mode: 'depthDrawMode',
  depth_test: 'depthTest',
  shading_mode: 'shadingMode',
  diffuse_mode: 'diffuseMode',
  specular_mode: 'specularMode',
  emission_operator: 'emissionOp',
  detail_blend_mode: 'detailBlendMode',
  detail_uv_layer: 'detailUv',
  texture_filter: 'textureFilter',
  billboard_mode: 'billboardMode',
  distance_fade_mode: 'distanceFade',
  stencil_compare: 'stencilCompare',
  stencil_reference: 'stencilReference',
};

const BOOLEANS: Readonly<Record<string, BooleanMember>> = {
  grow: 'grow',
  heightmap_deep_parallax: 'deepParallax',
  proximity_fade_enabled: 'proximityFade',
};

function setStencilFlags(key: MaterialKey, requested: number): void {
  key.stencilFlags = stencilFlagsAfterSet(key.stencilFlags, requested);
}

/** `set_stencil_mode` (`material.cpp:3231`): an outline or x-ray writes the stencil, always. */
function setStencilMode(key: MaterialKey, mode: MaterialKey['stencilMode']): void {
  if (key.stencilMode === mode) return;
  key.stencilMode = mode;
  if (mode !== StencilMode.OUTLINE && mode !== StencilMode.XRAY) return;
  setStencilFlags(key, StencilFlag.WRITE);
  key.stencilCompare = StencilCompare.ALWAYS;
}

/** Whether a channel setter takes `channel`: `ERR_FAIL_INDEX` refuses any other (`material.cpp:2964`). */
export const isTextureChannel = (channel: number): channel is EnumValue<typeof TextureChannel> =>
  Object.values(TextureChannel).includes(channel as never);

/** `set_roughness_texture_channel` (`material.cpp:2973`) ignores a value that is not a channel. */
function setRoughnessTextureChannel(key: MaterialKey, channel: number): void {
  if (isTextureChannel(channel)) key.roughnessTextureChannel = channel;
}

/** Each property the shader text reads, by name, with the setter that writes it into the key. */
const KEY_SETTERS = new Map<string, KeySetter>([
  ...Object.entries(FEATURES).map(([name, feature]): [string, KeySetter] => [
    name,
    (key, value) => void (setterBool(value) ? key.features.add(feature) : key.features.delete(feature)),
  ]),
  ...Object.entries(FLAGS).map(([name, flag]): [string, KeySetter] => [
    name,
    (key, value) => void (setterBool(value) ? key.flags.add(flag) : key.flags.delete(flag)),
  ]),
  ...Object.entries(NUMBERS).map(([name, member]): [string, KeySetter] => [
    name,
    (key, value) => void (key[member] = setterInt(value) as never),
  ]),
  ...Object.entries(BOOLEANS).map(([name, member]): [string, KeySetter] => [
    name,
    (key, value) => void (key[member] = setterBool(value)),
  ]),
  ['stencil_mode', (key, value) => setStencilMode(key, setterInt(value) as MaterialKey['stencilMode'])],
  ['stencil_flags', (key, value) => setStencilFlags(key, setterInt(value))],
  ['roughness_texture_channel', (key, value) => setRoughnessTextureChannel(key, setterInt(value))],
]);

/**
 * A material of class `materialClass` after Godot's setters ran on `settings`, in their order.
 * @canonical Model BaseMaterial3D's setters on its key and its other properties.
 */
export function materialStateOf(materialClass: MaterialClass, settings: MaterialSettings): MaterialState {
  const key = defaultKey(materialClass === 'ORMMaterial3D');
  const values: Record<string, MaterialValue> = {};
  for (const [name, value] of Object.entries(settings)) {
    const setter = KEY_SETTERS.get(name);
    if (setter) setter(key, value);
    else values[name] = value;
  }
  return { key, values };
}
