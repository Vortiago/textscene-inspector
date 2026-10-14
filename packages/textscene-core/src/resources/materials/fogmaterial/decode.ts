/**
 * FogMaterial decode, with the constructor's defaults (`scene/resources/3d/fog_material.cpp:165-173`).
 * `set_height_falloff` and `set_edge_fade` clamp a negative value to 0 (`:65`, `:74`).
 */

import { floatOr } from '../../../parser/valueParsers';
import { colorOr } from '../../../utils/colorParser';
import type { FogMaterialData } from './types';

export function decodeFogMaterial(properties: Record<string, string>): FogMaterialData {
  return {
    density: floatOr(properties.density, 1, 'FogMaterial density'),
    albedo: colorOr(properties.albedo, { r: 1, g: 1, b: 1, a: 1 }),
    emission: colorOr(properties.emission, { r: 0, g: 0, b: 0, a: 1 }),
    heightFalloff: Math.max(0, floatOr(properties.height_falloff, 0, 'FogMaterial height_falloff')),
    edgeFade: Math.max(0, floatOr(properties.edge_fade, 0.1, 'FogMaterial edge_fade')),
    densityTexture: properties.density_texture ?? null,
  };
}
