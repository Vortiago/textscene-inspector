/**
 * The class defaults of `Light3D` and of each light type, as their constructors set them. A light
 * type's table starts from `LIGHT_3D_DEFAULTS` and lists what its own constructor sets.
 */

import { DirectionalLightSkyMode } from '../rendering/lights/directionalLightSkyMode.js';
import { DirectionalShadowMode } from '../rendering/lights/directionalShadow.js';

/** `Light3D(LightType)` (`scene/3d/light_3d.cpp:473-491`) and its field initialisers (`light_3d.h:79-81`). */
export const LIGHT_3D_DEFAULTS = {
  energy: 1, // :473
  volumetricFogEnergy: 1, // :475
  specular: 0.5, // :476
  /** `omni_range`, `spot_range` and `area_range`. */
  range: 5, // :477
  /** `light_size`, and a DirectionalLight3D's `light_angular_distance`. */
  size: 0, // :478
  /** `omni_attenuation`, `spot_attenuation` and `area_attenuation`. */
  attenuation: 1, // :479
  spotAngle: 45, // :480
  spotAngleAttenuation: 1, // :481
  shadowSplitOffsets: [0.1, 0.2, 0.5], // :483-485, fractions of the shadowed range
  shadowPancakeSize: 20, // :487
  shadowOpacity: 1, // :488
  shadowBlur: 1, // :489
  shadowBias: 0.1, // :490
  shadowNormalBias: 1, // :491
  distanceFade: { begin: 40, shadow: 50, length: 10 }, // light_3d.h:79-81
} as const;

/** `DirectionalLight3D()` (`scene/3d/light_3d.cpp:600-608`). */
export const DIRECTIONAL_LIGHT_3D_DEFAULTS = {
  ...LIGHT_3D_DEFAULTS,
  shadowMaxDistance: 100, // :600
  shadowFadeStart: 0.8, // :601
  /** In texels of the shadow map. */
  shadowNormalBias: 2, // :603
  specular: 1, // :605
  shadowMode: DirectionalShadowMode.PARALLEL_4_SPLITS, // :606
  blendSplits: false, // :607
  skyMode: DirectionalLightSkyMode.LIGHT_AND_SKY, // :608
} as const;

/** `SpotLight3D()` (`scene/3d/light_3d.cpp:681`). */
export const SPOT_LIGHT_3D_DEFAULTS = {
  ...LIGHT_3D_DEFAULTS,
  shadowBias: 0.03,
} as const;

/** `AreaLight3D()` (4.7.2 `scene/3d/light_3d.cpp:746-750`). Godot 4.6.3 has no AreaLight3D. */
export const AREA_LIGHT_3D_DEFAULTS = {
  ...LIGHT_3D_DEFAULTS,
  shadowBias: 0.1, // :746
  size: 0.5, // :747
  specular: 1, // :748
  areaSize: { x: 1, y: 1 }, // :749
  areaNormalizeEnergy: true, // :750
} as const;
