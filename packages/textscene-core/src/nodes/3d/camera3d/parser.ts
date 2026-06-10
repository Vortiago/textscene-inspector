/**
 * Camera3D parser - parses Camera3D TSCN properties
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { Camera3DProperties } from './types';
import { ProjectionMode, KeepAspectMode } from './types';
import { parseNode3D } from '../../base/node3d/parser';

export function parseCamera3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Camera3DProperties {
  const baseProps = parseNode3D(heading, properties);

  return {
    ...baseProps,
    projection: parseProjectionMode(properties.projection),
    fov: parseFloat(properties.fov ?? '75.0'),
    size: parseFloat(properties.size ?? '1.0'),
    near: parseFloat(properties.near ?? '0.05'),
    far: parseFloat(properties.far ?? '4000.0'),
    keep_aspect: parseKeepAspectMode(properties.keep_aspect),
    h_offset: parseFloat(properties.h_offset ?? '0.0'),
    v_offset: parseFloat(properties.v_offset ?? '0.0'),
    frustum_offset: parseFrustumOffset(properties.frustum_offset),
    current: properties.current === 'true',
    cull_mask: parseInt(properties.cull_mask ?? '1048575', 10),
    doppler_tracking: parseInt(properties.doppler_tracking ?? '0', 10),
  };
}

function parseProjectionMode(value: string | undefined): ProjectionMode {
  if (value === undefined) return ProjectionMode.PROJECTION_PERSPECTIVE;
  const num = parseInt(value, 10);
  if (num === 1) return ProjectionMode.PROJECTION_ORTHOGONAL;
  if (num === 2) return ProjectionMode.PROJECTION_FRUSTUM;
  return ProjectionMode.PROJECTION_PERSPECTIVE;
}

function parseKeepAspectMode(value: string | undefined): KeepAspectMode {
  if (value === undefined) return KeepAspectMode.KEEP_HEIGHT;
  const num = parseInt(value, 10);
  if (num === 0) return KeepAspectMode.KEEP_WIDTH;
  if (num === 2) return KeepAspectMode.KEEP_ASPECT_DISABLED;
  return KeepAspectMode.KEEP_HEIGHT;
}

function parseFrustumOffset(value: string | undefined): { x: number; y: number } {
  if (!value) return { x: 0, y: 0 };

  // Parse Vector2(x, y) format
  const match = value.match(/Vector2\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)/);
  if (match && match[1] && match[2]) {
    return {
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
    };
  }

  return { x: 0, y: 0 };
}
