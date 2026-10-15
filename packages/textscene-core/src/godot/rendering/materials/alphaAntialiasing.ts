/** How a BaseMaterial3D, a Label3D or a Sprite3D antialiases its alpha edge. */

/**
 * `BaseMaterial3D::AlphaAntiAliasing` (scene/resources/material.h:196-200), which
 * `Label3D` and `SpriteBase3D` both re-bind and forward to their own
 * StandardMaterial3D. `GeometryInstance3D`, their common ancestor, lacks it.
 */
export const BASE_MATERIAL_ALPHA_ANTIALIASING = {
  0: 'OFF',
  1: 'ALPHA_TO_COVERAGE',
  2: 'ALPHA_TO_COVERAGE_AND_TO_ONE',
} as const;
