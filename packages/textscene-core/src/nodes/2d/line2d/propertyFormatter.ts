/**
 * Line2D property formatter — surfaces the polyline surface (vertex count,
 * width, color, closed), then delegates to formatNode2DProperties.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Line2DProperties } from './types';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';

export function formatLine2DProperties(properties: Line2DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const { defaultColor, width, closed } = properties;
  const vertexCount = Math.floor(properties.points.length / 2);

  sections.push({
    title: 'Line',
    items: [
      { label: 'Vertex Count', value: String(vertexCount) },
      { label: 'Width', value: String(width) },
      {
        label: 'Color',
        value: `(${defaultColor.r}, ${defaultColor.g}, ${defaultColor.b}, ${defaultColor.a})`,
      },
      { label: 'Closed', value: closed ? 'true' : 'false' },
    ],
  });

  sections.push(...formatNode2DProperties(properties));

  return sections;
}
