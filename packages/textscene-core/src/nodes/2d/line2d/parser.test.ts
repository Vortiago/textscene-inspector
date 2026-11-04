/**
 * The Line2D parser: `points` (flat Float32Array), `width`, `defaultColor`,
 * `closed` and the Node2D transform. Godot defaults: width = 10,
 * default_color = white, closed = false.
 */

import { describe, expect, it } from 'vitest';
import { parseLine2D } from './parser';
import { LineTextureMode } from '../../../godot/scene/line2d.js';
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

  it('parses the cap modes, defaulting to NONE', () => {
    const capped = parseLine2D(heading('Line2D', { name: 'L' }), { begin_cap_mode: '1', end_cap_mode: '2' });
    expect([capped.beginCapMode, capped.endCapMode]).toEqual([1, 2]);

    const bare = parseLine2D(heading('Line2D', { name: 'L' }), {});
    expect([bare.beginCapMode, bare.endCapMode]).toEqual([0, 0]);
  });

  it('keeps the gradient and width_curve references raw, and unset when absent', () => {
    const named = parseLine2D(heading('Line2D', { name: 'L' }), {
      gradient: 'SubResource("Gradient_a")',
      width_curve: 'ExtResource("2_curve")',
    });
    expect(named.gradient).toBe('SubResource("Gradient_a")');
    expect(named.widthCurve).toBe('ExtResource("2_curve")');

    const bare = parseLine2D(heading('Line2D', { name: 'L' }), {});
    expect(bare.gradient).toBeUndefined();
    expect(bare.widthCurve).toBeUndefined();
  });

  it('keeps the texture reference raw and reads texture_mode, unset and NONE by default', () => {
    const textured = parseLine2D(heading('Line2D', { name: 'L' }), {
      texture: 'ExtResource("1_tex")',
      texture_mode: '2',
    });
    expect(textured.texture).toBe('ExtResource("1_tex")');
    expect(textured.textureMode).toBe(LineTextureMode.STRETCH);

    const bare = parseLine2D(heading('Line2D', { name: 'L' }), {});
    expect(bare.texture).toBeUndefined();
    expect(bare.textureMode).toBe(LineTextureMode.NONE);
  });
});
