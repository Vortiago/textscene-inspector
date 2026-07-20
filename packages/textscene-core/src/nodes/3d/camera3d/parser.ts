/**
 * Camera3D parser - parses Camera3D TSCN properties
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { Camera3DProperties } from './types';
import { ProjectionMode, KeepAspectMode } from './types';
import { parseNode3D } from '../../base/node3d/parser';
import { floatOr, intOr, vec2Or } from '../../../parser/valueParsers';

export function parseCamera3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Camera3DProperties {
  const baseProps = parseNode3D(heading, properties);

  return {
    ...baseProps,
    projection: parseProjectionMode(properties.projection),
    fov: floatOr(properties.fov, 75.0, 'fov'),
    size: floatOr(properties.size, 1.0, 'size'),
    near: floatOr(properties.near, 0.05, 'near'),
    far: floatOr(properties.far, 4000.0, 'far'),
    keep_aspect: parseKeepAspectMode(properties.keep_aspect),
    h_offset: floatOr(properties.h_offset, 0.0, 'h_offset'),
    v_offset: floatOr(properties.v_offset, 0.0, 'v_offset'),
    frustum_offset: vec2Or(properties.frustum_offset, { x: 0, y: 0 }, 'frustum_offset'),
    current: properties.current === 'true',
    // class_camera3d.html: default 1048575 — the 20 editor-visible layers of
    // the 32 the mask actually holds.
    cull_mask: intOr(properties.cull_mask, 1048575, 'cull_mask'),
    doppler_tracking: intOr(properties.doppler_tracking, 0, 'doppler_tracking'),
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
