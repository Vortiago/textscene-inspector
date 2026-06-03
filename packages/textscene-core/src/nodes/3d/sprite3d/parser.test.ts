/**
 * Sprite3D runtime-parser tests.
 *
 * Covers defaults, every parsed property, and the bool / Vector2i / Rect2
 * formats specific to Sprite3D. Mirrors the depth of Label3D's parser
 * tests so the runtime parser is held to the same standard as the
 * strict-linter validators in linterParser.ts.
 */

import { describe, it, expect } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseSprite3D } from './parser';
import { AlphaCutMode, AxisMode, BillboardMode } from './types';

const HEADING: ParsedHeading = {
  type: 'node',
  attributes: { name: 'Sprite', type: 'Sprite3D' },
};

describe('parseSprite3D defaults', () => {
  it('applies Godot defaults when only the node heading is supplied', () => {
    const props = parseSprite3D(HEADING, {});
    expect(props.billboard).toBe(BillboardMode.BILLBOARD_DISABLED);
    expect(props.alpha_cut).toBe(AlphaCutMode.ALPHA_CUT_DISABLED);
    expect(props.axis).toBe(AxisMode.AXIS_Y);
    expect(props.pixel_size).toBe(0.01);
    expect(props.transparency).toBe(0);
    expect(props.hframes).toBe(1);
    expect(props.vframes).toBe(1);
    expect(props.frame).toBe(0);
    expect(props.offset).toEqual({ x: 0, y: 0 });
    expect(props.region_enabled).toBe(false);
    expect(props.modulate).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(props.render_priority).toBe(0);
    expect(props.texture).toBeUndefined();
    expect(props.frame_coords).toBeUndefined();
    expect(props.region_rect).toBeUndefined();
  });
});

describe('parseSprite3D properties', () => {
  it('parses texture resource reference verbatim', () => {
    const props = parseSprite3D(HEADING, { texture: 'ExtResource("1_t")' });
    expect(props.texture).toBe('ExtResource("1_t")');
  });

  it('parses billboard enum and rejects out-of-range values', () => {
    expect(parseSprite3D(HEADING, { billboard: '1' }).billboard).toBe(
      BillboardMode.BILLBOARD_ENABLED
    );
    expect(parseSprite3D(HEADING, { billboard: '2' }).billboard).toBe(
      BillboardMode.BILLBOARD_FIXED_Y
    );
    // 7 is out of range — falls back to default.
    expect(parseSprite3D(HEADING, { billboard: '7' }).billboard).toBe(
      BillboardMode.BILLBOARD_DISABLED
    );
  });

  it('parses alpha_cut enum', () => {
    expect(parseSprite3D(HEADING, { alpha_cut: '1' }).alpha_cut).toBe(
      AlphaCutMode.ALPHA_CUT_DISCARD
    );
    expect(parseSprite3D(HEADING, { alpha_cut: '2' }).alpha_cut).toBe(
      AlphaCutMode.ALPHA_CUT_OPAQUE_PREPASS
    );
  });

  it('parses pixel_size and transparency as floats', () => {
    const props = parseSprite3D(HEADING, { pixel_size: '0.025', transparency: '0.4' });
    expect(props.pixel_size).toBe(0.025);
    expect(props.transparency).toBe(0.4);
  });

  it('parses hframes / vframes / frame as integers', () => {
    const props = parseSprite3D(HEADING, { hframes: '4', vframes: '2', frame: '5' });
    expect(props.hframes).toBe(4);
    expect(props.vframes).toBe(2);
    expect(props.frame).toBe(5);
  });

  it('parses frame_coords as Vector2i', () => {
    const props = parseSprite3D(HEADING, { frame_coords: 'Vector2i(2, 1)' });
    expect(props.frame_coords).toEqual({ x: 2, y: 1 });
  });

  it('drops malformed frame_coords without throwing', () => {
    const props = parseSprite3D(HEADING, { frame_coords: 'Vector2i(1.5, 2.5)' });
    // Floats are rejected by the Vector2i regex; field stays undefined.
    expect(props.frame_coords).toBeUndefined();
  });

  it('parses offset as Vector2 (floats allowed)', () => {
    const props = parseSprite3D(HEADING, { offset: 'Vector2(1.5, -2.25)' });
    expect(props.offset).toEqual({ x: 1.5, y: -2.25 });
  });

  it('parses region_enabled "true" / "false"', () => {
    expect(parseSprite3D(HEADING, { region_enabled: 'true' }).region_enabled).toBe(true);
    expect(parseSprite3D(HEADING, { region_enabled: 'false' }).region_enabled).toBe(false);
  });

  it('parses region_rect as Rect2', () => {
    const props = parseSprite3D(HEADING, { region_rect: 'Rect2(10, 20, 30, 40)' });
    expect(props.region_rect).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('parses modulate Color', () => {
    const props = parseSprite3D(HEADING, { modulate: 'Color(1, 0.5, 0, 0.8)' });
    expect(props.modulate).toEqual({ r: 1, g: 0.5, b: 0, a: 0.8 });
  });

  it('parses render_priority as integer', () => {
    const props = parseSprite3D(HEADING, { render_priority: '-2' });
    expect(props.render_priority).toBe(-2);
  });

  it('inherits Node3D transform from base parser', () => {
    const props = parseSprite3D(HEADING, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, -3)',
    });
    expect(props.transform).toBeDefined();
    expect(props.transform!.origin).toEqual({ x: 5, y: 0, z: -3 });
  });
});
