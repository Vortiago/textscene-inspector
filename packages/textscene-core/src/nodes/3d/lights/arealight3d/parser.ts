/** AreaLight3D parser: the Light3D surface plus the area properties. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { AreaLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parsePositionalLightProperties } from '../shared/parser';
import { AREA_LIGHT_SIZE_DEFAULT } from '../../../../godot/areaLightShadow';
import { boolOr, floatOr, vec2Or } from '../../../../parser/valueParsers';

export function parseAreaLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): AreaLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parsePositionalLightProperties(properties);
  const areaSize = vec2Or(properties.area_size, { x: 1, y: 1 }, 'AreaLight3D');

  return {
    ...node3dProps,
    ...baseLightProps,
    // 4.7.2: light_3d.cpp:748 overrides the Light3D 0.5 of :492.
    light_specular: floatOr(properties.light_specular, 1.0, 'AreaLight3D'),
    light_size: floatOr(properties.light_size, AREA_LIGHT_SIZE_DEFAULT, 'AreaLight3D'),
    // 4.7.2: light_3d.cpp:493,495.
    area_range: floatOr(properties.area_range, 5.0, 'AreaLight3D'),
    area_attenuation: floatOr(properties.area_attenuation, 1.0, 'AreaLight3D'),
    // 4.7.2: light_3d.cpp:724, the setter stores `p_size.maxf(0.0f)`.
    area_size: { x: Math.max(areaSize.x, 0), y: Math.max(areaSize.y, 0) },
    area_normalize_energy: boolOr(properties.area_normalize_energy, true),
    area_texture: properties.area_texture,
  };
}
