/** Godot 4.6.3's BaseMaterial3D resource: its class defaults. */

import { EmissionOperator } from '../rendering/materials/emissionOperator.js';
import { TextureFilter } from '../rendering/materials/textureFilter.js';

/** The operator a material stores no `emission_operator` for (`scene/resources/material.h:610`). */
export const EMISSION_OPERATOR_DEFAULT = EmissionOperator.ADD;

/** What `BaseMaterial3D::BaseMaterial3D` sets (`material.cpp:3937-4000`) for a property stored as nothing. */
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
  pointSize: 1, // :3959
  triplanarSharpness: 1, // :3962, :3965
  refractionScale: 0.05, // :3958
  alphaScissorThreshold: 0.5, // :3975, the glTF alpha cutoff
  alphaHashScale: 1, // :3976
  aoLightAffect: 0, // :3983
  // `set_grow(0.0)` in the constructor; `set_grow_amount` (:2942) bare assigns.
  growAmount: 0, // :3990
  heightmapMinLayers: 8, // :3995
  heightmapMaxLayers: 32, // :3996
  /** `material.h:573`. */
  textureFilter: TextureFilter.LINEAR_WITH_MIPMAPS,
  albedo: [1, 1, 1, 1], // :3940
  emission: [0, 0, 0, 1], // :3944, `Color(0, 0, 0)`
  emissionEnergyMultiplier: 1, // :3945
  subsurfaceScatteringStrength: 0, // :3953
  backlight: [0, 0, 0, 1], // :3954
  transmittanceColor: [1, 1, 1, 1], // :3955
  transmittanceDepth: 0.1, // :3956
  transmittanceBoost: 0, // :3957
  uvOffset: [0, 0, 0], // :3960, :3963
  uvScale: [1, 1, 1], // :3961, :3964
  particlesAnimFrames: 1, // :3967, :3968
  particlesAnimLoop: false, // :3969
  alphaAntialiasingEdge: 0.3, // :3977
  proximityFadeDistance: 1, // :3979
  distanceFadeMinDistance: 0, // :3980
  distanceFadeMaxDistance: 10, // :3981
  msdfPixelRange: 4, // :3992
  msdfOutlineSize: 0, // :3993
  heightmapFlip: false, // :3997, which sets the binormal flip too
  zClipScale: 1, // :3999
  fovOverride: 75, // :4000
  /** `material.h:627`, `Color()`. */
  stencilEffectColor: [0, 0, 0, 1],
  /** `material.h:628`. */
  stencilEffectOutlineThickness: 0.01,
} as const;

/** The range `set_uv1_triplanar_blend_sharpness` and its UV2 twin clamp to (`material.cpp:2786`, :2814). */
export const TRIPLANAR_SHARPNESS_RANGE = { min: 0, max: 150 } as const;

/** The least distance `set_proximity_fade_distance` stores (`material.cpp:3087`). */
export const PROXIMITY_FADE_DISTANCE_MIN = 0.01;
