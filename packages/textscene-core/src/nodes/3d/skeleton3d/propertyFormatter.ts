/** Skeleton3D property formatter: the bone count and `show_rest_only`, ahead of the shared Node3D sections. */

import type { PropertySection } from '../../../core/NodeRegistry';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import type { Skeleton3DProperties } from './types';

export function formatSkeleton3DProperties(properties: Skeleton3DProperties): PropertySection[] {
  return [
    {
      title: 'Skeleton3D',
      items: [
        { label: 'Bones', value: properties.bones.length.toString() },
        { label: 'Show Rest Only', value: properties.showRestOnly.toString() },
      ],
    },
    ...formatNode3DProperties(properties),
  ];
}
