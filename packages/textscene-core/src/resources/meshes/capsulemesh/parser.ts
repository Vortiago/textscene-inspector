import type { CapsuleMeshProperties } from './types';
import { floatOr, intOr } from '../../../parser/valueParsers';

export function parseCapsuleMesh(properties: Record<string, string>): CapsuleMeshProperties {
  return {
    radius: floatOr(properties.radius, 0.5, 'CapsuleMesh radius'),
    height: floatOr(properties.height, 2.0, 'CapsuleMesh height'),
    radialSegments: intOr(properties.radial_segments, 64, 'CapsuleMesh radialSegments'),
    rings: intOr(properties.rings, 8, 'CapsuleMesh rings'),
  };
}
