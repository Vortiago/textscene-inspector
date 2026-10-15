/**
 * The ClassDB property rows of a class the pinned build lacks, as `UNCATALOGUED` in
 * `nodeBaseTypes.ts` holds its base. Each row comes from the source of the release that adds the
 * class, in the `[name, Variant::Type, PropertyHint, hint_string]` shape of
 * `classProperties.generated.ts`. The captures supply them once the pin moves.
 */

import type { ClassPropertyRow } from './classProperties.generated.js';

export const UNCATALOGUED_PROPERTIES: Readonly<Record<string, readonly ClassPropertyRow[]>> = Object.freeze({
  // 4.7.2 `scene/3d/light_3d.cpp:764-768`.
  AreaLight3D: [
    ['area_attenuation', 3, 1, '-10,10,0.001,or_greater,or_less'],
    ['area_normalize_energy', 1, 0, ''],
    ['area_range', 3, 1, '0,4096,0.001,or_greater,exp,suffix:m'],
    ['area_size', 5, 5, 'suffix:m'],
    [
      'area_texture',
      24,
      17,
      'Texture2D,-AnimatedTexture,-AtlasTexture,-CameraTexture,-CanvasTexture,-MeshTexture,-Texture2DRD,-ViewportTexture',
    ],
  ],
});
