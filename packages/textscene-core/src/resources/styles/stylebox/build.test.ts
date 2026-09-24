import { describe, expect, it } from 'vitest';
import { buildStyleBoxCss, controlColorToCss } from './build';
import { decodeStyleBox } from './decode';
import type { StyleBoxFlatData } from './types';

const css = (properties: Record<string, string>) => {
  const decoded = decodeStyleBox('StyleBoxFlat', properties);
  if (!decoded) throw new Error('expected a decoded box');
  return buildStyleBoxCss(decoded);
};

describe('buildStyleBoxCss', () => {
  it('maps fill, corner radius, border and padding', () => {
    const style = css({
      bg_color: 'Color(0.76, 0.71, 0.55, 1)',
      corner_radius_top_left: '4',
      corner_radius_top_right: '4',
      corner_radius_bottom_right: '4',
      corner_radius_bottom_left: '4',
      border_width_left: '2',
      border_width_top: '2',
      border_width_right: '2',
      border_width_bottom: '2',
      border_color: 'Color(0.2, 0.18, 0.12, 1)',
      content_margin_left: '10',
      content_margin_top: '6',
      content_margin_right: '10',
      content_margin_bottom: '6',
    });
    expect(style.backgroundColor).toBe('rgba(194, 181, 140, 1)');
    expect(style.borderRadius).toBe('4px 4px 4px 4px');
    expect(style.borderStyle).toBe('solid');
    expect(style.borderWidth).toBe('2px 2px 2px 2px');
    expect(style.borderColor).toBe('rgba(51, 46, 31, 1)');
    expect(style.padding).toBe('6px 10px 6px 10px');
  });

  it('paints the default fill for a box that never sets bg_color', () => {
    // StyleBoxFlat's bg_color default is Color(0.6, 0.6, 0.6)
    // (style_box_flat.h:38) and the editor omits a property still at its
    // default, so an absent bg_color is a grey fill, not a transparent box.
    expect(css({}).backgroundColor).toBe('rgba(153, 153, 153, 1)');
    expect(css({ border_width_left: '1' }).backgroundColor).toBe('rgba(153, 153, 153, 1)');
  });

  it('paints the default fill for a malformed bg_color too', () => {
    expect(css({ bg_color: 'Color(nope)' }).backgroundColor).toBe('rgba(153, 153, 153, 1)');
  });

  it('paints no fill when draw_center is off, keeping the border', () => {
    const style = css({
      bg_color: 'Color(0.2, 0.2, 0.2, 1)',
      draw_center: 'false',
      border_width_left: '2',
      border_color: 'Color(1, 1, 1, 1)',
    });
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderColor).toBe('rgba(255, 255, 255, 1)');
  });

  it('says "no fill" out loud rather than omitting the property', () => {
    // StyleBoxFlat::draw (style_box_flat.cpp:455-460) paints nothing with no border,
    // centre or shadow. An absent backgroundColor would show a consumer default,
    // so a box with no fill says `transparent`. Only an unresolved box says nothing.
    expect(css({ draw_center: 'false' })).toEqual({ backgroundColor: 'transparent' });
  });

  it('renders StyleBoxEmpty as an explicitly empty fill (style_box.h:80)', () => {
    // StyleBoxEmpty::draw has an empty body: a Control themed with one paints
    // nothing, so it must not fall through to a consumer default either.
    expect(buildStyleBoxCss({ kind: 'empty' })).toEqual({ backgroundColor: 'transparent' });
  });

  it('emits no border, radius or padding for a plain fill', () => {
    const style = css({ bg_color: 'Color(1, 1, 1, 1)' });
    expect(style.borderStyle).toBeUndefined();
    expect(style.borderWidth).toBeUndefined();
    expect(style.borderRadius).toBeUndefined();
    expect(style.padding).toBeUndefined();
  });

  it('pads by the border width when no content margin is set', () => {
    expect(css({ border_width_top: '2', border_width_bottom: '2' }).padding).toBe(
      '2px 0px 2px 0px'
    );
  });

  it('draws the shadow only from shadow_size 1 up', () => {
    expect(css({ shadow_size: '4' }).boxShadow).toBe('0px 0px 4px rgba(0, 0, 0, 0.6)');
    expect(
      css({ shadow_size: '8', shadow_color: 'Color(1, 0, 0, 0.5)', shadow_offset: 'Vector2(3, -2)' })
        .boxShadow
    ).toBe('3px -2px 8px rgba(255, 0, 0, 0.5)');
    expect(css({ shadow_size: '0' }).boxShadow).toBeUndefined();
    expect(css({}).boxShadow).toBeUndefined();
  });

  it('takes decoded data straight, with no property bag in sight', () => {
    // The build half's contract: data in, CSS out, with no Godot text.
    const data: StyleBoxFlatData = {
      kind: 'flat',
      bgColor: { r: 1, g: 0, b: 0, a: 1 },
      drawCenter: true,
      cornerRadius: { topLeft: 1, topRight: 2, bottomRight: 3, bottomLeft: 4 },
      borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
      borderColor: { r: 0, g: 0, b: 0, a: 1 },
      contentMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      shadowSize: 0,
      shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
      shadowOffset: { x: 0, y: 0 },
    };
    expect(buildStyleBoxCss(data)).toEqual({
      backgroundColor: 'rgba(255, 0, 0, 1)',
      borderRadius: '1px 2px 3px 4px',
    });
  });
});

describe('controlColorToCss', () => {
  it('formats 0..1 channels as 0..255 rgba', () => {
    expect(controlColorToCss({ r: 1, g: 0.5, b: 0, a: 0.25 })).toBe('rgba(255, 128, 0, 0.25)');
  });

  it('clamps overbright (HDR) channels and alpha so CSS stays valid', () => {
    expect(controlColorToCss({ r: 2, g: 0, b: 0, a: 1 })).toBe('rgba(255, 0, 0, 1)');
    expect(controlColorToCss({ r: -1, g: 0.5, b: 3, a: 2 })).toBe('rgba(0, 128, 255, 1)');
  });
});
