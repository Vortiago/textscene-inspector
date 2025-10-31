import type { TorusMeshProperties } from './types';
import { warn } from '../../../logger';

export function parseTorusMesh(properties: Record<string, string>): TorusMeshProperties {
  let innerRadius = 0.5;
  let outerRadius = 1.0;
  let rings = 32;
  let ringSegments = 16;

  if (properties.inner_radius) {
    const parsed = parseFloat(properties.inner_radius);
    if (isNaN(parsed)) {
      warn(`Invalid TorusMesh inner_radius: ${properties.inner_radius}`);
    } else {
      innerRadius = parsed;
    }
  }

  if (properties.outer_radius) {
    const parsed = parseFloat(properties.outer_radius);
    if (isNaN(parsed)) {
      warn(`Invalid TorusMesh outer_radius: ${properties.outer_radius}`);
    } else {
      outerRadius = parsed;
    }
  }

  if (properties.rings) {
    const parsed = parseInt(properties.rings, 10);
    if (isNaN(parsed)) {
      warn(`Invalid TorusMesh rings: ${properties.rings}`);
    } else {
      rings = parsed;
    }
  }

  if (properties.ring_segments) {
    const parsed = parseInt(properties.ring_segments, 10);
    if (isNaN(parsed)) {
      warn(`Invalid TorusMesh ring_segments: ${properties.ring_segments}`);
    } else {
      ringSegments = parsed;
    }
  }

  return { innerRadius, outerRadius, rings, ringSegments };
}
