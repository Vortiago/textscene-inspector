/**
 * Light nodes, 2D and 3D, plus the 2D light occluder.
 *
 * `Light3D` declares its rows on the abstract base, so each reaches
 * `DirectionalLight3D`/`OmniLight3D`/`SpotLight3D` through the base walk rather
 * than through an `appliesTo`.
 */
import type { WarningRow } from './types.js';

export const lightWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  Light3D: [
    {
      at: 'light_3d.cpp:184',
      says: "a light's scale does not affect its visual size",
      verdict: { rule: 'light3d-non-unit-scale' },
    },
  ],

  // AreaLight3D is new in 4.7, so its rows cite the 4.7.2 tree.
  AreaLight3D: [
    {
      at: 'light_3d.cpp:775',
      says: 'projector texture is not supported for area lights',
      verdict: { rule: 'arealight3d-projector-unsupported' },
    },
    {
      at: 'light_3d.cpp:778',
      says: 'textured area lights are not drawn by the Compatibility renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), light_3d.cpp:777' },
    },
    {
      at: 'light_3d.cpp:782',
      says: 'area light shadows do not work in the Compatibility renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), light_3d.cpp:781' },
    },
  ],

  LightOccluder2D: [
    {
      at: 'light_occluder_2d.cpp:270',
      says: 'an occluder polygon must be set to take effect',
      verdict: { rule: 'lightoccluder2d-requires-occluder' },
    },
    {
      at: 'light_occluder_2d.cpp:274',
      says: 'the occluder polygon has less than the required points',
      verdict: {
        declined: 'runtime-only',
        because: "resolved OccluderPolygon2D's polygon VALUE, light_occluder_2d.cpp:273",
      },
    },
  ],

  OmniLight3D: [
    {
      at: 'light_3d.cpp:624',
      says: 'projector texture only works with shadows active',
      verdict: { rule: 'omnilight3d-projector-without-shadow' },
    },
    {
      at: 'light_3d.cpp:628',
      says: 'projector textures not yet supported by the Compatibility renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), light_3d.cpp:627' },
    },
  ],

  PointLight2D: [
    {
      at: 'light_2d.cpp:435',
      says: 'requires a texture to display',
      verdict: { rule: 'pointlight2d-requires-texture' },
    },
  ],

  SpotLight3D: [
    {
      at: 'light_3d.cpp:656',
      says: 'an angle wider than 90 degrees cannot cast shadows',
      verdict: { rule: 'spotlight3d-shadow-angle-too-wide' },
    },
    {
      at: 'light_3d.cpp:660',
      says: 'projector texture only works with shadows active',
      verdict: { rule: 'spotlight3d-projector-without-shadow' },
    },
    {
      at: 'light_3d.cpp:664',
      says: 'projector textures not yet supported by the Compatibility renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), light_3d.cpp:663' },
    },
  ],
};
