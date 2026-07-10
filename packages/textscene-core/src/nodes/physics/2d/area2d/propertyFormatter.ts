/**
 * Area2D property formatter — surfaces monitoring/monitorable/layer/mask
 * (Godot defaults when the TSCN omits them) ahead of the shared Node2D
 * transform sections.
 */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { Area2DProperties } from './types';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';

export function formatArea2DProperties(properties: Area2DProperties): PropertySection[] {
  const sections: PropertySection[] = [
    {
      title: 'Area2D',
      items: [
        { label: 'Monitoring', value: (properties.monitoring ?? true).toString() },
        { label: 'Monitorable', value: (properties.monitorable ?? true).toString() },
        { label: 'Collision Layer', value: (properties.collision_layer ?? 1).toString() },
        { label: 'Collision Mask', value: (properties.collision_mask ?? 1).toString() },
      ],
    },
  ];

  sections.push(...formatNode2DProperties(properties));

  return sections;
}
