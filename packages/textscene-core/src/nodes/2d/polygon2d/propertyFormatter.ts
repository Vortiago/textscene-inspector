/**
 * Formats Polygon2D properties: the fill colour, vertex count, offset and
 * texture reference, then the shared Node2D sections.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Polygon2DProperties } from './types';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';

export function formatPolygon2DProperties(properties: Polygon2DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const { color, offset } = properties;
  const vertexCount = Math.floor(properties.polygon.length / 2);

  sections.push({
    title: 'Polygon',
    items: [
      { label: 'Vertices', value: vertexCount.toString() },
      {
        label: 'Color',
        value: `(${color.r}, ${color.g}, ${color.b}, ${color.a})`,
      },
      { label: 'Offset', value: `(${offset.x}, ${offset.y})` },
      { label: 'Texture', value: properties.texture ?? '(none)' },
    ],
  });

  sections.push(...formatNode2DProperties(properties));

  return sections;
}
