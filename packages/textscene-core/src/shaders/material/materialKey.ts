import { AlphaAntiAliasing } from '../../godot/rendering/materials/alphaAntialiasing.js';
import { BillboardMode } from '../../godot/rendering/materials/billboardMode.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { CullMode } from '../../godot/rendering/materials/cullMode.js';
import { DepthDrawMode } from '../../godot/rendering/materials/depthDrawMode.js';
import { DepthTest } from '../../godot/rendering/materials/depthTest.js';
import { DetailUV } from '../../godot/rendering/materials/detailUv.js';
import { DiffuseMode } from '../../godot/rendering/materials/diffuseMode.js';
import { DistanceFadeMode } from '../../godot/rendering/materials/distanceFadeMode.js';
import { EmissionOperator } from '../../godot/rendering/materials/emissionOperator.js';
import { ShadingMode } from '../../godot/rendering/materials/shadingMode.js';
import { SpecularMode } from '../../godot/rendering/materials/specularMode.js';
import { StencilCompare, StencilMode } from '../../godot/rendering/materials/stencil.js';
import { TextureChannel } from '../../godot/rendering/materials/textureChannel.js';
import { TextureFilter } from '../../godot/rendering/materials/textureFilter.js';
import { Transparency } from '../../godot/rendering/materials/transparency.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { BASE_MATERIAL_3D_DEFAULTS } from '../../godot/scene/baseMaterial3D.js';

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

/** Godot's `MaterialKey` (`material.h:359`): every member the shader text reads, and nothing else. */
export interface MaterialKey {
  orm: boolean;
  textureFilter: EnumValue<typeof TextureFilter>;
  detailUv: EnumValue<typeof DetailUV>;
  transparency: EnumValue<typeof Transparency>;
  alphaAntialiasingMode: EnumValue<typeof AlphaAntiAliasing>;
  shadingMode: EnumValue<typeof ShadingMode>;
  blendMode: EnumValue<typeof BlendMode>;
  depthDrawMode: EnumValue<typeof DepthDrawMode>;
  depthTest: EnumValue<typeof DepthTest>;
  cullMode: EnumValue<typeof CullMode>;
  diffuseMode: EnumValue<typeof DiffuseMode>;
  specularMode: EnumValue<typeof SpecularMode>;
  billboardMode: EnumValue<typeof BillboardMode>;
  detailBlendMode: EnumValue<typeof BlendMode>;
  roughnessTextureChannel: EnumValue<typeof TextureChannel>;
  emissionOp: EnumValue<typeof EmissionOperator>;
  distanceFade: EnumValue<typeof DistanceFadeMode>;
  stencilMode: EnumValue<typeof StencilMode>;
  stencilFlags: number;
  stencilCompare: EnumValue<typeof StencilCompare>;
  stencilReference: number;
  deepParallax: boolean;
  grow: boolean;
  proximityFade: boolean;
  readonly features: Set<Feature>;
  readonly flags: Set<Flag>;
}

/** The key of a material Godot's constructor leaves as it is (`material.cpp:3936`). */
export function defaultKey(orm: boolean): MaterialKey {
  return {
    orm,
    textureFilter: BASE_MATERIAL_3D_DEFAULTS.textureFilter,
    detailUv: DetailUV.DETAIL_UV_1,
    transparency: Transparency.DISABLED,
    alphaAntialiasingMode: AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF,
    shadingMode: ShadingMode.PER_PIXEL,
    blendMode: BlendMode.MIX,
    depthDrawMode: DepthDrawMode.OPAQUE_ONLY,
    depthTest: DepthTest.DEFAULT,
    cullMode: CullMode.BACK,
    diffuseMode: DiffuseMode.DIFFUSE_BURLEY,
    specularMode: SpecularMode.SPECULAR_SCHLICK_GGX,
    billboardMode: BillboardMode.BILLBOARD_DISABLED,
    detailBlendMode: BlendMode.MIX,
    roughnessTextureChannel: TextureChannel.TEXTURE_CHANNEL_RED,
    emissionOp: EmissionOperator.ADD,
    distanceFade: DistanceFadeMode.DISABLED,
    stencilMode: StencilMode.DISABLED,
    stencilFlags: 0,
    stencilCompare: StencilCompare.ALWAYS,
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

/** Alpha hash and alpha scissor are the transparencies that take alpha antialiasing. */
export const isAlphaTested = (key: MaterialKey): boolean =>
  key.transparency === Transparency.ALPHA_HASH || key.transparency === Transparency.ALPHA_SCISSOR;

export const usesAlphaAntialiasing = (key: MaterialKey): boolean =>
  key.alphaAntialiasingMode !== AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF && isAlphaTested(key);

/** MSDF albedo takes effect only without UV1 triplanar, which Godot prefers with a warning. */
export const isMsdf = (key: MaterialKey): boolean =>
  key.flags.has('ALBEDO_TEXTURE_MSDF') && !key.flags.has('UV1_USE_TRIPLANAR');

export const usesDetailUv2 = (key: MaterialKey): boolean =>
  key.features.has('DETAIL') && key.detailUv === DetailUV.DETAIL_UV_2;
