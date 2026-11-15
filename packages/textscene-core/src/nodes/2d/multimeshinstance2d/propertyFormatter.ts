/** Formats MultiMeshInstance2D properties for the details panel: the MultiMesh and texture, then Node2D. */

import type { PropertySection } from '../../../core/NodeRegistry';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import type { MultiMeshInstance2DProperties } from './types';

export function formatMultiMeshInstance2DProperties(
  properties: MultiMeshInstance2DProperties
): PropertySection[] {
  return [
    {
      title: 'MultiMesh',
      items: [
        { label: 'MultiMesh', value: properties.multimesh ?? '(none)' },
        { label: 'Texture', value: properties.texture ?? '(none)' },
      ],
    },
    ...formatNode2DProperties(properties),
  ];
}
