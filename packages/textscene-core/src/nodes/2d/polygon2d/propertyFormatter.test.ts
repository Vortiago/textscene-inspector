import { describe, expect, it } from 'vitest';
import { formatPolygon2DProperties } from './propertyFormatter';
import { parsePolygon2D } from './parser';
import type { ParsedHeading } from '../../../parser/utils';

function props(rawProps: Record<string, string>) {
  const heading: ParsedHeading = { type: 'node', attributes: { name: 'Poly', type: 'Polygon2D' } };
  return parsePolygon2D(heading, rawProps);
}

describe('formatPolygon2DProperties', () => {
  it('reports the vertex count, color, offset, and texture in a Polygon section', () => {
    const sections = formatPolygon2DProperties(
      props({
        polygon: 'PackedVector2Array(0, 0, 1, 0, 1, 1, 0, 1)',
        color: 'Color(0.5, 0.25, 0.75, 1)',
        texture: 'SubResource("8")',
      })
    );
    const polygon = sections.find((s) => s.title === 'Polygon');
    expect(polygon).toBeDefined();
    const byLabel = Object.fromEntries(polygon!.items.map((i) => [i.label, i.value]));
    expect(byLabel.Vertices).toBe('4');
    expect(byLabel.Texture).toBe('SubResource("8")');
    expect(byLabel.Color).toContain('0.5');
  });

  it('shows (none) when no texture is set and includes the Node2D sections', () => {
    const sections = formatPolygon2DProperties(props({ polygon: 'PackedVector2Array(0, 0, 1, 0, 1, 1)' }));
    const polygon = sections.find((s) => s.title === 'Polygon')!;
    const texture = polygon.items.find((i) => i.label === 'Texture');
    expect(texture!.value).toBe('(none)');
    // Node2D transform section appended after the Polygon section.
    expect(sections.length).toBeGreaterThan(1);
  });
});
