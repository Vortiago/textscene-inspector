/**
 * Camera3D property formatter - formats camera properties for display with camera switching
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Camera3DProperties } from './types';
import { ProjectionMode, KeepAspectMode } from './types';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';

export function formatCamera3DProperties(properties: Camera3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  // Camera section
  const cameraItems: PropertySection['items'] = [
    { label: 'Projection', value: getProjectionModeName(properties.projection) },
    { label: 'Keep Aspect', value: getKeepAspectModeName(properties.keep_aspect) },
  ];

  // Add projection-specific properties
  if (properties.projection === ProjectionMode.PROJECTION_PERSPECTIVE) {
    cameraItems.push({ label: 'FOV', value: `${properties.fov.toFixed(1)}°` });
  } else if (properties.projection === ProjectionMode.PROJECTION_ORTHOGONAL) {
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
  if (properties.h_offset !== 0 || properties.v_offset !== 0 || properties.frustum_offset.x !== 0 || properties.frustum_offset.y !== 0) {
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
        value: `(${properties.frustum_offset.x.toFixed(2)}, ${properties.frustum_offset.y.toFixed(2)})`
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

function getProjectionModeName(mode: ProjectionMode): string {
  switch (mode) {
    case ProjectionMode.PROJECTION_PERSPECTIVE:
      return 'Perspective';
    case ProjectionMode.PROJECTION_ORTHOGONAL:
      return 'Orthogonal';
    case ProjectionMode.PROJECTION_FRUSTUM:
      return 'Frustum';
    default:
      return 'Unknown';
  }
}

function getKeepAspectModeName(mode: KeepAspectMode): string {
  switch (mode) {
    case KeepAspectMode.KEEP_WIDTH:
      return 'Keep Width';
    case KeepAspectMode.KEEP_HEIGHT:
      return 'Keep Height';
    default:
      return 'Unknown';
  }
}
