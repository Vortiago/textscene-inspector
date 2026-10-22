/**
 * Camera3D property formatter: formats camera properties for display, with camera switching.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Camera3DProperties } from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import {
  CAMERA_3D_KEEP_ASPECT_HINT_NAMES,
  CAMERA_3D_PROJECTION_HINT_NAMES,
  Camera3DProjectionType,
} from '../../../godot/scene/camera3d';

export function formatCamera3DProperties(properties: Camera3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  // Camera section
  const cameraItems: PropertySection['items'] = [
    { label: 'Projection', value: CAMERA_3D_PROJECTION_HINT_NAMES[properties.projection] ?? 'Unknown' },
    { label: 'Keep Aspect', value: CAMERA_3D_KEEP_ASPECT_HINT_NAMES[properties.keep_aspect] ?? 'Unknown' },
  ];

  // Add projection-specific properties
  if (properties.projection === Camera3DProjectionType.PERSPECTIVE) {
    cameraItems.push({ label: 'FOV', value: `${properties.fov.toFixed(1)}°` });
  } else if (properties.projection === Camera3DProjectionType.ORTHOGONAL) {
    cameraItems.push({ label: 'Size', value: properties.size.toFixed(2) });
  }

  cameraItems.push(
    { label: 'Near', value: properties.near.toFixed(3) },
    { label: 'Far', value: properties.far.toFixed(1) }
  );

  sections.push({
    title: 'Camera',
    items: cameraItems,
  });

  // Offsets section (only if non-zero)
  if (
    properties.h_offset !== 0 ||
    properties.v_offset !== 0 ||
    properties.frustum_offset.x !== 0 ||
    properties.frustum_offset.y !== 0
  ) {
    const offsetItems: PropertySection['items'] = [];

    if (properties.h_offset !== 0) {
      offsetItems.push({ label: 'H Offset', value: properties.h_offset.toFixed(2) });
    }
    if (properties.v_offset !== 0) {
      offsetItems.push({ label: 'V Offset', value: properties.v_offset.toFixed(2) });
    }
    if (properties.frustum_offset.x !== 0 || properties.frustum_offset.y !== 0) {
      offsetItems.push({
        label: 'Frustum Offset',
        value: `(${properties.frustum_offset.x.toFixed(2)}, ${properties.frustum_offset.y.toFixed(2)})`,
      });
    }

    sections.push({
      title: 'Offsets',
      items: offsetItems,
    });
  }

  // Additional properties section
  const additionalItems: PropertySection['items'] = [
    { label: 'Current', value: properties.current ? 'Yes' : 'No' },
    { label: 'Cull Mask', value: properties.cull_mask.toString() },
  ];

  if (properties.doppler_tracking !== 0) {
    additionalItems.push({ label: 'Doppler Tracking', value: properties.doppler_tracking.toString() });
  }

  sections.push({
    title: 'Additional',
    items: additionalItems,
  });

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}
