/**
 * WorldEnvironment property formatter - formats WorldEnvironment properties for display
 */

import type { PropertySection } from '../../../core/NodeRegistry.js';
import type { WorldEnvironmentProperties } from './types.js';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter.js';

export function formatWorldEnvironmentProperties(properties: WorldEnvironmentProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  // Environment section
  const environmentItems: PropertySection['items'] = [
    { label: 'Environment', value: properties.environment || '(none)' },
  ];

  if (properties.camera_attributes) {
    environmentItems.push({ label: 'Camera Attributes', value: properties.camera_attributes });
  }

  sections.push({
    title: 'Environment',
    items: environmentItems,
  });

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}
