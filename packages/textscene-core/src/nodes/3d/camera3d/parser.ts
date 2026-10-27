/**
 * Camera3D parser: parses Camera3D TSCN properties.
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { Camera3DProperties } from './types';
import { parseNode3D } from '../../base/node3d/parser';
import { floatOr, intOr, vec2Or } from '../../../parser/valueParsers';
import { slotInt } from '../../../godot/variant/intSlots.js';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import { GODOT_EDITOR_LAYERS_MASK } from '../../../godot/scene/visualLayers.js';
import { Camera3DProjectionType, Camera3DKeepAspect } from '../../../godot/scene/camera3d';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

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
    current: boolSlotValue(properties.current) === true,
    attributes: properties.attributes,
    cull_mask: intOr(properties.cull_mask, GODOT_EDITOR_LAYERS_MASK, 'cull_mask', 'uint32'),
    doppler_tracking: intOr(properties.doppler_tracking, 0, 'doppler_tracking'),
  };
}

function parseProjectionMode(value: string | undefined): EnumValue<typeof Camera3DProjectionType> {
  const num = slotInt(value);
  if (num === null) return Camera3DProjectionType.PERSPECTIVE;
  if (num === 1) return Camera3DProjectionType.ORTHOGONAL;
  if (num === 2) return Camera3DProjectionType.FRUSTUM;
  return Camera3DProjectionType.PERSPECTIVE;
}

/**
 * `set_keep_aspect_mode` bare-assigns, and `_update_camera_mode` then treats
 * anything that is not KEEP_WIDTH as KEEP_HEIGHT, so an out-of-range value loads and behaves as
 * KEEP_HEIGHT. There is no third mode: `camera_3d.h:50-53` declares two.
 */
function parseKeepAspectMode(value: string | undefined): EnumValue<typeof Camera3DKeepAspect> {
  return slotInt(value) === 0 ? Camera3DKeepAspect.KEEP_WIDTH : Camera3DKeepAspect.KEEP_HEIGHT;
}
