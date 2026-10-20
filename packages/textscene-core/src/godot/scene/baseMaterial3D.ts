/** Godot 4.6.3's BaseMaterial3D resource: its class defaults. */

import { EmissionOperator } from '../rendering/materials/emissionOperator.js';
import { TextureFilter } from '../rendering/materials/textureFilter.js';

/** The operator a material stores no `emission_operator` for (`scene/resources/material.h:610`). */
export const EMISSION_OPERATOR_DEFAULT = EmissionOperator.ADD;

/**
 * The defaults `BaseMaterial3D::BaseMaterial3D` sets (`scene/resources/material.cpp:3937-4000`),
 * for the properties a material stores nothing for. The setters check no range.
 */
export const BASE_MATERIAL_3D_DEFAULTS = {
  specular: 0.5, // :3941
  roughness: 1, // :3942
  metallic: 0, // :3943
  normalScale: 1, // :3946
  rim: 1, // :3947
  rimTint: 0.5, // :3948
  clearcoat: 1, // :3949
  clearcoatRoughness: 0.5, // :3950
  anisotropy: 0, // :3951
  heightmapScale: 5, // :3952
  refractionScale: 0.05, // :3958
  alphaScissorThreshold: 0.5, // :3975, the glTF alpha cutoff
  alphaHashScale: 1, // :3976
  aoLightAffect: 0, // :3983
  heightmapMinLayers: 8, // :3995
  heightmapMaxLayers: 32, // :3996
  /** `material.h:573`. */
  textureFilter: TextureFilter.LINEAR_WITH_MIPMAPS,
} as const;
