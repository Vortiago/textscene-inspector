import { describe, expect, it } from 'vitest';
import { parsePolygon2D } from './parser';
import type { ParsedHeading } from '../../../parser/utils';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parsePolygon2D', () => {
  it('parses the witnessed polygon/color/position form', () => {
    const props = parsePolygon2D(heading({ name: 'Polygon2DInverted', type: 'Polygon2D' }), {
      position: 'Vector2(480, -416)',
      color: 'Color(0.717647, 0.686275, 0.231373, 1)',
      polygon: 'PackedVector2Array(65.3057, 508.435, 117.632, 527.527, 155.815, 517.627, 155.108, 478.029)',
    });
    // Float32Array stores 32-bit floats, so compare with tolerance.
    const expected = [65.3057, 508.435, 117.632, 527.527, 155.815, 517.627, 155.108, 478.029];
    expect(props.polygon.length).toBe(expected.length);
    expected.forEach((v, i) => expect(props.polygon[i]).toBeCloseTo(v, 3));
    expect(props.color.r).toBeCloseTo(0.717647, 5);
    expect(props.color.a).toBe(1);
    expect(props.position).toEqual({ x: 480, y: -416 });
  });

  it('captures the texture reference when present', () => {
    const props = parsePolygon2D(heading({ name: 'Tex', type: 'Polygon2D' }), {
      texture: 'SubResource("8")',
      polygon: 'PackedVector2Array(0, 0, 1, 0, 1, 1)',
    });
    expect(props.texture).toBe('SubResource("8")');
  });

  it('defaults color to white and offset to (0,0) when absent', () => {
    const props = parsePolygon2D(heading({ name: 'P', type: 'Polygon2D' }), {
      polygon: 'PackedVector2Array(0, 0, 2, 0, 2, 2)',
    });
    expect(props.color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(props.offset).toEqual({ x: 0, y: 0 });
  });

  it('tolerates a missing polygon (empty array, no throw)', () => {
    const props = parsePolygon2D(heading({ name: 'Empty', type: 'Polygon2D' }), {});
    expect(props.polygon.length).toBe(0);
  });

  it('tolerates a malformed polygon by falling back to empty', () => {
    const props = parsePolygon2D(heading({ name: 'Bad', type: 'Polygon2D' }), {
      polygon: 'PackedVector2Array(0, nope, 1)',
    });
    expect(props.polygon.length).toBe(0);
  });
});
