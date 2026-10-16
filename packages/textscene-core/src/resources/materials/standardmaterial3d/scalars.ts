/**
 * `StandardMaterial3DData` → the three-flavoured scalar bag both adapters apply: a
 * mapping, not a second decode. `decode.ts` stays renderer-free for the linter's import
 * closure (ADR-0031), while `blending` and `side` are three constants.
 */

import * as THREE from 'three';
import { godotBlendState } from './blendState';
import { decodeStandardMaterial3D } from './decode';
import { textureChannelMask } from '../../../godot/rendering/materials/textureChannel';
import { CullMode, type StandardMaterial3DData, type StandardMaterial3DScalars } from './types';

/**
 * Godot's cull mode names the faces it discards, and three's `side` names the ones it
 * keeps. `_update_shader` emits `cull_back` / `cull_front` / `cull_disabled`, so
 * CULL_BACK (the default) draws front faces.
 */
const SIDE: Readonly<Record<CullMode, THREE.Side>> = {
  [CullMode.BACK]: THREE.FrontSide,
  [CullMode.FRONT]: THREE.BackSide,
  [CullMode.DISABLED]: THREE.DoubleSide,
};

function standardMaterial3DScalars(data: StandardMaterial3DData): StandardMaterial3DScalars {
  return {
    ...godotBlendState(data.blendMode),
    color: data.albedo,
    opacity: data.alpha,
    metalness: data.metallic,
    roughness: data.roughness,
    specular: data.specular,
    emissive: data.emission.emissive,
    emissiveIntensity: data.emission.emissiveIntensity,
    emissionEnergy: data.emission.emissionEnergy,
    emissionOperator: data.emissionOperator,
    textureFilter: data.textureFilter,
    textureRepeat: data.textureRepeat,
    uv1Scale: data.uv1Scale,
    uv1Offset: data.uv1Offset,
    uv2Scale: data.uv2Scale,
    uv2Offset: data.uv2Offset,
    uv2Triplanar: data.uv2Triplanar,
    uv2Slots: data.uv2Slots,
    transparent: data.transparent,
    castsShadow: data.castsShadow,
    alphaTest: data.alphaTest,
    alphaHash: data.alphaHash,
    alphaHashScale: data.alphaHashScale,
    alphaAntialiasing: data.alphaAntialiasing,
    depthWrite: data.depthWrite,
    alphaPassDepthWrite: data.alphaPassDepthWrite,
    depthInAlphaPass: data.depthInAlphaPass,
    readsAlbedoAlpha: data.readsAlbedoAlpha,
    opaqueAfterCut: data.opaqueAfterCut,
    depthTest: data.depthTest,
    shadingMode: data.shadingMode,
    diffuseMode: data.diffuseMode,
    specularMode: data.specularMode,
    useVertexColors: data.useVertexColors,
    disablesSpecularOcclusion: data.disablesSpecularOcclusion,
    aoLightAffect: data.aoLightAffect,
    aoTextureChannelMask: textureChannelMask(data.aoTextureChannel),
    roughnessTextureChannelMask: textureChannelMask(data.roughnessTextureChannel),
    metallicTextureChannelMask: textureChannelMask(data.metallicTextureChannel),
    side: SIDE[data.cullMode],
    cullModeExplicit: data.cullModeExplicit,
    normalScale: data.normalScale,
    triplanar: data.triplanar,
    clearcoat: data.clearcoat,
    clearcoatRoughness: data.clearcoatRoughness,
    rim: data.rim,
    rimTint: data.rimTint,
    heightmap: data.heightmap,
    billboardMode: data.billboardMode,
    billboardKeepScale: data.billboardKeepScale,
    anisotropy: data.anisotropy,
    transmission: data.transmission,
    refractionThickness: data.refractionThickness,
    textureSlots: data.textureSlots,
  };
}

/**
 * Raw Godot property strings → the scalars a material slot renders. The synchronous
 * entry point of every StandardMaterial3D-bearing node component. The caller resolves
 * external textures.
 */
export function parseStandardMaterial3DScalars(
  properties: Record<string, string>
): StandardMaterial3DScalars {
  return standardMaterial3DScalars(decodeStandardMaterial3D(properties));
}
