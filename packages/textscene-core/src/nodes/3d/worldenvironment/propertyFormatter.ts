/**
 * WorldEnvironment property formatter - formats WorldEnvironment properties for display
 */

import type { PropertySection } from '../../../core/NodeRegistry.js';
import type { WorldEnvironmentProperties } from './types.js';

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

  return sections;
}
