import {
  defaultKey,
  STENCIL_COMPARE_ALWAYS,
  STENCIL_FLAG,
  STENCIL_MODE,
  type Feature,
  type Flag,
  type MaterialKey,
} from './materialKey.js';

/** A texture a material property holds: Godot sets `albedo_texture_size` from the albedo's size. */
export interface MaterialTexture {
  readonly width: number;
  readonly height: number;
}

/** A property value: a bool, an enum index or a number, a colour or vector as lanes, or a texture. */
export type MaterialValue = boolean | number | readonly number[] | MaterialTexture;

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

const FEATURES: Readonly<Record<string, Feature>> = {
  emission_enabled: 'EMISSION',
  normal_enabled: 'NORMAL_MAPPING',
  bent_normal_enabled: 'BENT_NORMAL_MAPPING',
  rim_enabled: 'RIM',
  clearcoat_enabled: 'CLEARCOAT',
  anisotropy_enabled: 'ANISOTROPY',
  ao_enabled: 'AMBIENT_OCCLUSION',
  heightmap_enabled: 'HEIGHT_MAPPING',
  subsurf_scatter_enabled: 'SUBSURFACE_SCATTERING',
  subsurf_scatter_transmittance_enabled: 'SUBSURFACE_TRANSMITTANCE',
  backlight_enabled: 'BACKLIGHT',
  refraction_enabled: 'REFRACTION',
  detail_enabled: 'DETAIL',
};

const FLAGS: Readonly<Record<string, Flag>> = {
  no_depth_test: 'DISABLE_DEPTH_TEST',
  disable_ambient_light: 'DISABLE_AMBIENT_LIGHT',
  disable_fog: 'DISABLE_FOG',
  disable_specular_occlusion: 'DISABLE_SPECULAR_OCCLUSION',
  vertex_color_use_as_albedo: 'ALBEDO_FROM_VERTEX_COLOR',
  vertex_color_is_srgb: 'SRGB_VERTEX_COLOR',
  albedo_texture_force_srgb: 'ALBEDO_TEXTURE_FORCE_SRGB',
  albedo_texture_msdf: 'ALBEDO_TEXTURE_MSDF',
  emission_on_uv2: 'EMISSION_ON_UV2',
  ao_on_uv2: 'AO_ON_UV2',
  heightmap_flip_texture: 'INVERT_HEIGHTMAP',
  subsurf_scatter_skin_mode: 'SUBSURFACE_MODE_SKIN',
  uv1_triplanar: 'UV1_USE_TRIPLANAR',
  uv1_world_triplanar: 'UV1_USE_WORLD_TRIPLANAR',
  uv2_triplanar: 'UV2_USE_TRIPLANAR',
  uv2_world_triplanar: 'UV2_USE_WORLD_TRIPLANAR',
  texture_repeat: 'USE_TEXTURE_REPEAT',
  disable_receive_shadows: 'DONT_RECEIVE_SHADOWS',
  shadow_to_opacity: 'USE_SHADOW_TO_OPACITY',
  billboard_keep_scale: 'BILLBOARD_KEEP_SCALE',
  fixed_size: 'FIXED_SIZE',
  use_point_size: 'USE_POINT_SIZE',
  use_particle_trails: 'PARTICLE_TRAILS_MODE',
  use_z_clip_scale: 'USE_Z_CLIP_SCALE',
  use_fov_override: 'USE_FOV_OVERRIDE',
};

type NumberMember = {
  [Member in keyof MaterialKey]: MaterialKey[Member] extends number ? Member : never;
}[keyof MaterialKey];

/** The enum properties whose setter only stores the value, by the key member each one sets. */
const ENUMS: Readonly<Record<string, NumberMember>> = {
  transparency: 'transparency',
  alpha_antialiasing_mode: 'alphaAntialiasingMode',
  blend_mode: 'blendMode',
  cull_mode: 'cullMode',
  depth_draw_mode: 'depthDrawMode',
  depth_test: 'depthTest',
  shading_mode: 'shadingMode',
  diffuse_mode: 'diffuseMode',
  specular_mode: 'specularMode',
  roughness_texture_channel: 'roughnessTextureChannel',
  emission_operator: 'emissionOp',
  detail_blend_mode: 'detailBlendMode',
  detail_uv_layer: 'detailUv',
  texture_filter: 'textureFilter',
  billboard_mode: 'billboardMode',
  distance_fade_mode: 'distanceFade',
  stencil_compare: 'stencilCompare',
  stencil_reference: 'stencilReference',
};

const BOOLEANS = {
  grow: 'grow',
  heightmap_deep_parallax: 'deepParallax',
  proximity_fade_enabled: 'proximityFade',
} as const satisfies Readonly<Record<string, keyof MaterialKey>>;

/** `set_stencil_flags` (`material.cpp:3251`): read and write exclude each other, and the old flags decide. */
function setStencilFlags(key: MaterialKey, requested: number): void {
  if (key.stencilFlags === requested) return;
  const writes = STENCIL_FLAG.WRITE | STENCIL_FLAG.WRITE_DEPTH_FAIL;
  let flags = requested;
  if (flags & STENCIL_FLAG.READ && key.stencilFlags & writes) flags &= STENCIL_FLAG.READ;
  if (flags & writes && key.stencilFlags & STENCIL_FLAG.READ) flags &= writes;
  if (flags & STENCIL_FLAG.READ && flags & writes) flags &= STENCIL_FLAG.READ;
  key.stencilFlags = flags;
}

/** `set_stencil_mode` (`material.cpp:3231`): an outline or x-ray writes the stencil, always. */
function setStencilMode(key: MaterialKey, mode: number): void {
  if (key.stencilMode === mode) return;
  key.stencilMode = mode;
  if (mode !== STENCIL_MODE.OUTLINE && mode !== STENCIL_MODE.XRAY) return;
  setStencilFlags(key, STENCIL_FLAG.WRITE);
  key.stencilCompare = STENCIL_COMPARE_ALWAYS;
}

/** The setter of property `name` that changes the key, or none for a property the text does not read. */
function keySetterOf(name: string): KeySetter | undefined {
  const feature = FEATURES[name];
  if (feature) return (key, value) => void (value ? key.features.add(feature) : key.features.delete(feature));
  const flag = FLAGS[name];
  if (flag) return (key, value) => void (value ? key.flags.add(flag) : key.flags.delete(flag));
  const member = ENUMS[name];
  if (member) return (key, value) => void (key[member] = Number(value));
  if (name in BOOLEANS) {
    const booleanMember = BOOLEANS[name as keyof typeof BOOLEANS];
    return (key, value) => void (key[booleanMember] = Boolean(value));
  }
  if (name === 'stencil_mode') return (key, value) => setStencilMode(key, Number(value));
  if (name === 'stencil_flags') return (key, value) => setStencilFlags(key, Number(value));
  return undefined;
}

/**
 * A material of class `materialClass` after Godot's setters ran on `settings`, in their order.
 * @canonical Model BaseMaterial3D's setters on its key and its other properties.
 */
export function materialStateOf(materialClass: MaterialClass, settings: MaterialSettings): MaterialState {
  const key = defaultKey(materialClass === 'ORMMaterial3D');
  const values: Record<string, MaterialValue> = {};
  for (const [name, value] of Object.entries(settings)) {
    const setter = keySetterOf(name);
    if (setter) setter(key, value);
    else values[name] = value;
  }
  return { key, values };
}
