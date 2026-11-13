/** Formats MeshInstance2D properties for the details panel: the mesh and texture, then Node2D. */

import type { PropertySection } from '../../../core/NodeRegistry';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import type { MeshInstance2DProperties } from './types';

export function formatMeshInstance2DProperties(properties: MeshInstance2DProperties): PropertySection[] {
  return [
    {
      title: 'Mesh',
      items: [
        { label: 'Mesh', value: properties.mesh ?? '(none)' },
        { label: 'Texture', value: properties.texture ?? '(none)' },
      ],
    },
    ...formatNode2DProperties(properties),
  ];
}
