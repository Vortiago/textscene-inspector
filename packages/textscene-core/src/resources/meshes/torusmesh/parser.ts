import type { TorusMeshProperties } from './types';
import { floatOr, intOr } from '../../../parser/valueParsers';

export function parseTorusMesh(properties: Record<string, string>): TorusMeshProperties {
  return {
    innerRadius: floatOr(properties.inner_radius, 0.5, 'TorusMesh innerRadius'),
    outerRadius: floatOr(properties.outer_radius, 1.0, 'TorusMesh outerRadius'),
    rings: intOr(properties.rings, 64, 'TorusMesh rings'),
    ringSegments: intOr(properties.ring_segments, 32, 'TorusMesh ringSegments'),
  };
}
