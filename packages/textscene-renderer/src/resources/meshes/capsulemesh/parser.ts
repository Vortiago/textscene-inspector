import type { CapsuleMeshProperties } from './types';
import { warn } from '../../../logger';

export function parseCapsuleMesh(properties: Record<string, string>): CapsuleMeshProperties {
  let radius = 0.5;
  let height = 2.0;
  let radialSegments = 64;
  let rings = 8;

  if (properties.radius) {
    const parsed = parseFloat(properties.radius);
    if (isNaN(parsed)) {
      warn(`Invalid CapsuleMesh radius: ${properties.radius}`);
    } else {
      radius = parsed;
    }
  }

  if (properties.height) {
    const parsed = parseFloat(properties.height);
    if (isNaN(parsed)) {
      warn(`Invalid CapsuleMesh height: ${properties.height}`);
    } else {
      height = parsed;
    }
  }

  if (properties.radial_segments) {
    const parsed = parseInt(properties.radial_segments, 10);
    if (isNaN(parsed)) {
      warn(`Invalid CapsuleMesh radial_segments: ${properties.radial_segments}`);
    } else {
      radialSegments = parsed;
    }
  }

  if (properties.rings) {
    const parsed = parseInt(properties.rings, 10);
    if (isNaN(parsed)) {
      warn(`Invalid CapsuleMesh rings: ${properties.rings}`);
    } else {
      rings = parsed;
    }
  }

  return { radius, height, radialSegments, rings };
}
