/** The features of `BaseMaterial3D::Feature` (`material.h`), each a property that ends in `_enabled`. */
export type Feature =
  | 'EMISSION'
  | 'NORMAL_MAPPING'
  | 'RIM'
  | 'CLEARCOAT'
  | 'ANISOTROPY'
  | 'AMBIENT_OCCLUSION'
  | 'HEIGHT_MAPPING'
  | 'SUBSURFACE_SCATTERING'
  | 'SUBSURFACE_TRANSMITTANCE'
  | 'BACKLIGHT'
  | 'REFRACTION'
  | 'DETAIL'
  | 'BENT_NORMAL_MAPPING';

/** The flags of `BaseMaterial3D::Flags` (`material.h`). */
export type Flag =
  | 'DISABLE_DEPTH_TEST'
  | 'ALBEDO_FROM_VERTEX_COLOR'
  | 'SRGB_VERTEX_COLOR'
  | 'USE_POINT_SIZE'
  | 'FIXED_SIZE'
  | 'BILLBOARD_KEEP_SCALE'
  | 'UV1_USE_TRIPLANAR'
  | 'UV2_USE_TRIPLANAR'
  | 'UV1_USE_WORLD_TRIPLANAR'
  | 'UV2_USE_WORLD_TRIPLANAR'
  | 'AO_ON_UV2'
  | 'EMISSION_ON_UV2'
  | 'ALBEDO_TEXTURE_FORCE_SRGB'
  | 'DONT_RECEIVE_SHADOWS'
  | 'DISABLE_AMBIENT_LIGHT'
  | 'USE_SHADOW_TO_OPACITY'
  | 'USE_TEXTURE_REPEAT'
  | 'INVERT_HEIGHTMAP'
  | 'SUBSURFACE_MODE_SKIN'
  | 'PARTICLE_TRAILS_MODE'
  | 'ALBEDO_TEXTURE_MSDF'
  | 'DISABLE_FOG'
  | 'DISABLE_SPECULAR_OCCLUSION'
  | 'USE_Z_CLIP_SCALE'
  | 'USE_FOV_OVERRIDE';

/** Godot's `MaterialKey` (`material.h:359`): every member the text reads, an enum as its value's index. */
export interface MaterialKey {
  orm: boolean;
  textureFilter: number;
  detailUv: number;
  transparency: number;
  alphaAntialiasingMode: number;
  shadingMode: number;
  blendMode: number;
  depthDrawMode: number;
  depthTest: number;
  cullMode: number;
  diffuseMode: number;
  specularMode: number;
  billboardMode: number;
  detailBlendMode: number;
  roughnessTextureChannel: number;
  emissionOp: number;
  distanceFade: number;
  stencilMode: number;
  stencilFlags: number;
  stencilCompare: number;
  stencilReference: number;
  deepParallax: boolean;
  grow: boolean;
  proximityFade: boolean;
  readonly features: Set<Feature>;
  readonly flags: Set<Flag>;
}

export const TEXTURE_FILTER_LINEAR_WITH_MIPMAPS = 3;
export const DETAIL_UV_2 = 1;
export const TRANSPARENCY = {
  DISABLED: 0,
  ALPHA_SCISSOR: 2,
  ALPHA_HASH: 3,
  ALPHA_DEPTH_PRE_PASS: 4,
} as const;
export const ALPHA_ANTIALIASING = { OFF: 0, ALPHA_TO_COVERAGE: 1, ALPHA_TO_COVERAGE_AND_TO_ONE: 2 } as const;
export const SHADING_MODE = { UNSHADED: 0, PER_PIXEL: 1, PER_VERTEX: 2 } as const;
export const DEPTH_DRAW_ALWAYS = 1;
export const BILLBOARD = { DISABLED: 0, ENABLED: 1, FIXED_Y: 2, PARTICLES: 3 } as const;
export const EMISSION_OP_ADD = 0;
export const DISTANCE_FADE = { DISABLED: 0, PIXEL_ALPHA: 1, PIXEL_DITHER: 2, OBJECT_DITHER: 3 } as const;
export const STENCIL_MODE = { DISABLED: 0, OUTLINE: 1, XRAY: 2, CUSTOM: 3 } as const;
export const STENCIL_FLAG = { READ: 1, WRITE: 2, WRITE_DEPTH_FAIL: 4 } as const;
export const STENCIL_COMPARE_ALWAYS = 0;

/** The key of a material Godot's constructor leaves as it is (`material.cpp:3936`). */
export function defaultKey(orm: boolean): MaterialKey {
  return {
    orm,
    textureFilter: TEXTURE_FILTER_LINEAR_WITH_MIPMAPS,
    detailUv: 0,
    transparency: TRANSPARENCY.DISABLED,
    alphaAntialiasingMode: ALPHA_ANTIALIASING.OFF,
    shadingMode: SHADING_MODE.PER_PIXEL,
    blendMode: 0,
    depthDrawMode: 0,
    depthTest: 0,
    cullMode: 0,
    diffuseMode: 0,
    specularMode: 0,
    billboardMode: BILLBOARD.DISABLED,
    detailBlendMode: 0,
    roughnessTextureChannel: 0,
    emissionOp: EMISSION_OP_ADD,
    distanceFade: DISTANCE_FADE.DISABLED,
    stencilMode: STENCIL_MODE.DISABLED,
    stencilFlags: 0,
    stencilCompare: STENCIL_COMPARE_ALWAYS,
    stencilReference: 1,
    deepParallax: false,
    grow: false,
    proximityFade: false,
    features: new Set(),
    flags: new Set(['USE_TEXTURE_REPEAT']),
  };
}

/** One string for one key, as Godot compares keys by their bytes. */
export function keyText(key: MaterialKey): string {
  const { features, flags, ...members } = key;
  return JSON.stringify([members, [...features].sort(), [...flags].sort()]);
}
