/**
 * RED contract for the Line2D parser. Pins the parsed shape:
 * `points` (flat Float32Array), `width` (number), `defaultColor` (Color),
 * `closed` (boolean), plus the Node2D transform base. Godot defaults:
 * width = 10, default_color = white, closed = false. Mirrors the Polygon2D
 * parser test. Witnessed form is the `Line2DSharpNone` node from
 * scenes/demos/2d/polygons_lines/polygons_lines.tscn.
 */

import { describe, expect, it } from 'vitest';
import { parseLine2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('parseLine2D', () => {
  it('parses the witnessed points/width/default_color/position form', () => {
    const props = parseLine2D(heading('Line2D', { name: 'Line2DSharpNone' }), {
      position: 'Vector2(8, 40)',
      points: 'PackedVector2Array(411.081, 529.648, 500.884, 379.034, 568.766, 526.113)',
      width: '30.0',
      default_color: 'Color(1, 1, 1, 0.752941)',
    });
    // Float32Array stores 32-bit floats, so compare with tolerance.
    const expected = [411.081, 529.648, 500.884, 379.034, 568.766, 526.113];
    expect(props.points.length).toBe(expected.length);
    expected.forEach((v, i) => expect(props.points[i]).toBeCloseTo(v, 3));
    expect(props.width).toBeCloseTo(30, 5);
    expect(props.defaultColor.r).toBeCloseTo(1, 5);
    expect(props.defaultColor.a).toBeCloseTo(0.752941, 5);
    expect(props.position).toEqual({ x: 8, y: 40 });
  });

  it('parses the closed flag', () => {
    const props = parseLine2D(heading('Line2D', { name: 'L' }), {
      points: 'PackedVector2Array(0, 0, 10, 0, 10, 10)',
      closed: 'true',
    });
    expect(props.closed).toBe(true);
  });

  it('defaults width=10, default_color=white, closed=false when absent (Godot defaults)', () => {
    const props = parseLine2D(heading('Line2D', { name: 'L' }), {
      points: 'PackedVector2Array(0, 0, 1, 0)',
    });
    expect(props.width).toBe(10);
    expect(props.defaultColor).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(props.closed).toBe(false);
  });

  it('tolerates missing points (empty array, no throw)', () => {
    const props = parseLine2D(heading('Line2D', { name: 'Empty' }), {});
    expect(props.points.length).toBe(0);
  });

  it('tolerates a single point (one vertex pair, no throw)', () => {
    const props = parseLine2D(heading('Line2D', { name: 'One' }), {
      points: 'PackedVector2Array(5, 5)',
    });
    expect(props.points.length).toBe(2);
  });

  it('tolerates a malformed points array by falling back to empty', () => {
    const props = parseLine2D(heading('Line2D', { name: 'Bad' }), {
      points: 'PackedVector2Array(0, nope, 1)',
    });
    expect(props.points.length).toBe(0);
  });
});
