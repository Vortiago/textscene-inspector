import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeStyleBox } from './decode';
import { parseTresFile } from '../../../parser/parsedResource';
import * as logger from '../../../logger';
import type { StyleBoxFlatData } from './types';

const flat = (properties: Record<string, string>): StyleBoxFlatData => {
  const decoded = decodeStyleBox('StyleBoxFlat', properties);
  if (!decoded || decoded.kind !== 'flat') throw new Error('expected a flat box');
  return decoded;
};

describe('decodeStyleBox — StyleBoxFlat', () => {
  it('reads the fill, corners, border and shadow an authored box carries', () => {
    const box = flat({
      bg_color: 'Color(0.76, 0.71, 0.55, 1)',
      corner_radius_top_left: '4',
      corner_radius_bottom_right: '8',
      border_width_left: '2',
      border_width_bottom: '3',
      border_color: 'Color(0.2, 0.18, 0.12, 1)',
      shadow_size: '4',
      shadow_color: 'Color(1, 0, 0, 0.5)',
      shadow_offset: 'Vector2(3, -2)',
    });
    expect(box.bgColor).toEqual({ r: 0.76, g: 0.71, b: 0.55, a: 1 });
    expect(box.cornerRadius).toEqual({ topLeft: 4, topRight: 0, bottomRight: 8, bottomLeft: 0 });
    expect(box.borderWidth).toEqual({ left: 2, top: 0, right: 0, bottom: 3 });
    expect(box.borderColor).toEqual({ r: 0.2, g: 0.18, b: 0.12, a: 1 });
    expect(box.shadowSize).toBe(4);
    expect(box.shadowColor).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
    expect(box.shadowOffset).toEqual({ x: 3, y: -2 });
  });

  it('applies Godot’s member-initialiser defaults for every absent property', () => {
    const box = flat({});
    expect(box.bgColor).toEqual({ r: 0.6, g: 0.6, b: 0.6, a: 1 }); // h:38
    expect(box.borderColor).toEqual({ r: 0.8, g: 0.8, b: 0.8, a: 1 }); // h:40
    expect(box.shadowColor).toEqual({ r: 0, g: 0, b: 0, a: 0.6 }); // h:39
    expect(box.drawCenter).toBe(true); // h:46
    expect(box.shadowSize).toBe(0); // h:52
    expect(box.shadowOffset).toEqual({ x: 0, y: 0 }); // h:53
    expect(box.cornerRadius).toEqual({ topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 });
    expect(box.borderWidth).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    expect(box.contentMargin).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('reports each border width as the content margin of a side left unset', () => {
    // StyleBox::get_margin (style_box.cpp:78-86): content_margin < 0 (the −1
    // default) reports get_style_margin, the side's border width.
    const box = flat({
      border_width_left: '2',
      border_width_top: '2',
      border_width_right: '2',
      border_width_bottom: '2',
      content_margin_left: '10',
    });
    expect(box.contentMargin).toEqual({ left: 10, top: 2, right: 2, bottom: 2 });
  });

  it('takes an explicit zero content margin over the border width', () => {
    const box = flat({ border_width_top: '6', content_margin_top: '0' });
    expect(box.contentMargin.top).toBe(0);
  });

  it('keeps a negative explicit content margin on the border-width fallback', () => {
    const box = flat({ border_width_top: '6', content_margin_top: '-1' });
    expect(box.contentMargin.top).toBe(6);
  });

  it('reads draw_center = false (the border-only box)', () => {
    expect(flat({ draw_center: 'false' }).drawCenter).toBe(false);
  });
});

describe('decodeStyleBox — box types', () => {
  it('decodes StyleBoxEmpty as a box that paints nothing', () => {
    expect(decodeStyleBox('StyleBoxEmpty', {})).toEqual({ kind: 'empty' });
  });

  it('returns null for a StyleBox type this slice does not claim', () => {
    expect(decodeStyleBox('StyleBoxTexture', { texture: 'ExtResource("1_a")' })).toBeNull();
    expect(decodeStyleBox('StyleBoxLine', {})).toBeNull();
  });

  it('returns null for a resource that is not a StyleBox at all', () => {
    expect(decodeStyleBox('StandardMaterial3D', {})).toBeNull();
  });
});

describe('decodeStyleBox — malformed values', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('falls back to the property default for a malformed colour', () => {
    // A property with its own default falls back to it, as border_color already
    // did — the skip-instead-of-whiten rule governs theme_override_colors, where
    // a skipped entry means "inherit".
    const box = flat({ bg_color: 'Color(nope)', border_color: 'not-a-color' });
    expect(box.bgColor).toEqual({ r: 0.6, g: 0.6, b: 0.6, a: 1 });
    expect(box.borderColor).toEqual({ r: 0.8, g: 0.8, b: 0.8, a: 1 });
  });

  it('warns and falls back, never NaN, for a malformed scalar or vector', () => {
    const box = flat({
      corner_radius_top_left: 'garbage',
      border_width_left: 'garbage',
      content_margin_left: 'garbage',
      shadow_size: 'garbage',
      shadow_offset: 'Vector2(--1, 2)',
    });
    expect(box.cornerRadius.topLeft).toBe(0);
    expect(box.borderWidth.left).toBe(0);
    expect(box.contentMargin.left).toBe(0); // −1 fallback → the border width
    expect(box.shadowSize).toBe(0);
    expect(box.shadowOffset).toEqual({ x: 0, y: 0 });
    expect(Number.isNaN(box.shadowSize)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('stays silent for an absent property', () => {
    flat({});
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('decodeStyleBox over a ParsedResource body', () => {
  it('decodes an external .tres box the same way an inline sub-resource decodes', () => {
    const parsed = parseTresFile(`[gd_resource type="StyleBoxFlat" format=3]

[resource]
bg_color = Color(0, 0.5, 1, 1)
border_width_top = 4
`);
    expect(parsed.resourceType).toBe('StyleBoxFlat');
    expect(decodeStyleBox(parsed.resourceType, parsed.properties)).toEqual(
      decodeStyleBox('StyleBoxFlat', { bg_color: 'Color(0, 0.5, 1, 1)', border_width_top: '4' })
    );
  });
});
