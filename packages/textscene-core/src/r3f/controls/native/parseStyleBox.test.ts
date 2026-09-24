/**
 * `parseStyleBox` resolves a SubResource reference to a typed `StyleBoxFlatData`.
 * Defaults come from `scene/resources/style_box_flat.h`/`.cpp` and
 * `style_box.cpp::get_margin` (Godot 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import { parseStyleBox } from './parseStyleBox';
import type { TscnInternalResource } from '../../../parser/types';

const resources: TscnInternalResource[] = [
  {
    id: 'StyleBoxFlat_full',
    type: 'StyleBoxFlat',
    data: {
      bg_color: 'Color(1, 0, 0, 1)',
      border_color: 'Color(0, 1, 0, 1)',
      border_width_left: '2',
      border_width_top: '3',
      border_width_right: '4',
      border_width_bottom: '5',
      corner_radius_top_left: '6',
      corner_radius_top_right: '7',
      corner_radius_bottom_right: '8',
      corner_radius_bottom_left: '9',
      expand_margin_left: '1',
      expand_margin_top: '2',
      expand_margin_right: '3',
      expand_margin_bottom: '4',
      content_margin_left: '10',
      content_margin_top: '11',
      content_margin_right: '12',
      content_margin_bottom: '13',
      draw_center: 'false',
      border_blend: 'true',
      anti_aliasing: 'false',
      anti_aliasing_size: '3',
      corner_detail: '5',
      skew: 'Vector2(0.3, -0.2)',
      shadow_color: 'Color(0, 0, 1, 0.4)',
      shadow_size: '7',
      shadow_offset: 'Vector2(3, 4)',
    },
  },
  { id: 'StyleBoxFlat_empty', type: 'StyleBoxFlat', data: {} },
  {
    id: 'StyleBoxFlat_border_only',
    type: 'StyleBoxFlat',
    data: { border_width_left: '3', border_width_top: '3', border_width_right: '3', border_width_bottom: '3' },
  },
  { id: 'StyleBoxFlat_aa_size_too_small', type: 'StyleBoxFlat', data: { anti_aliasing_size: '0' } },
  { id: 'StyleBoxFlat_corner_detail_too_small', type: 'StyleBoxFlat', data: { corner_detail: '0' } },
  { id: 'StyleBoxFlat_corner_detail_too_large', type: 'StyleBoxFlat', data: { corner_detail: '50' } },
  { id: 'StyleBoxFlat_aa_size_too_large', type: 'StyleBoxFlat', data: { anti_aliasing_size: '50' } },
  { id: 'StyleBoxEmpty_x', type: 'StyleBoxEmpty', data: {} },
  {
    id: 'StyleBoxEmpty_margins',
    type: 'StyleBoxEmpty',
    data: { content_margin_left: '7', content_margin_bottom: '3' },
  },
  { id: 'StandardMaterial3D_m', type: 'StandardMaterial3D', data: {} },
  {
    id: 'StyleBoxLine_x',
    type: 'StyleBoxLine',
    data: { color: 'Color(1, 0, 0, 1)', thickness: '2', vertical: 'true', grow_begin: '3', grow_end: '4' },
  },
  {
    id: 'StyleBoxTexture_x',
    type: 'StyleBoxTexture',
    data: { texture: 'ExtResource("1_tex")', texture_margin_left: '5' },
  },
];

describe('parseStyleBox', () => {
  it('resolves every field of a fully-specified StyleBoxFlat SubResource', () => {
    const box = parseStyleBox('SubResource("StyleBoxFlat_full")', [], resources);
    expect(box).toEqual({
      bgColor: { r: 1, g: 0, b: 0, a: 1 },
      borderColor: { r: 0, g: 1, b: 0, a: 1 },
      borderWidth: { left: 2, top: 3, right: 4, bottom: 5 },
      cornerRadius: { topLeft: 6, topRight: 7, bottomRight: 8, bottomLeft: 9 },
      expandMargin: { left: 1, top: 2, right: 3, bottom: 4 },
      contentMargin: { left: 10, top: 11, right: 12, bottom: 13 },
      drawCenter: false,
      borderBlend: true,
      antiAliased: false,
      aaSize: 3,
      cornerDetail: 5,
      skew: { x: 0.3, y: -0.2 },
      shadowColor: { r: 0, g: 0, b: 1, a: 0.4 },
      shadowSize: 7,
      shadowOffset: { x: 3, y: 4 },
    });
  });

  it('falls back to Godot documented defaults for every absent key', () => {
    // The member defaults in `style_box_flat.h` (`style_box_flat.h:39,48-53`).
    // A colour literal without alpha has an alpha of 1.
    const box = parseStyleBox('SubResource("StyleBoxFlat_empty")', [], resources);
    expect(box).toEqual({
      bgColor: { r: 0.6, g: 0.6, b: 0.6, a: 1 },
      borderColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
      borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
      cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      contentMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      drawCenter: true,
      borderBlend: false,
      antiAliased: true,
      aaSize: 1,
      cornerDetail: 8,
      skew: { x: 0, y: 0 },
      shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
      shadowSize: 0,
      shadowOffset: { x: 0, y: 0 },
    });
  });

  it('clamps an authored anti_aliasing_size below the setter minimum to 0.01 (StyleBoxFlat::set_aa_size)', () => {
    const box = parseStyleBox('SubResource("StyleBoxFlat_aa_size_too_small")', [], resources);
    expect(box?.aaSize).toBeCloseTo(0.01);
  });

  it('clamps an authored anti_aliasing_size above the setter maximum to 10 (StyleBoxFlat::set_aa_size)', () => {
    const box = parseStyleBox('SubResource("StyleBoxFlat_aa_size_too_large")', [], resources);
    expect(box?.aaSize).toBe(10);
  });

  it('clamps an authored corner_detail to the setter range 1..20 (StyleBoxFlat::set_corner_detail)', () => {
    // style_box_flat.cpp:130: CLAMP(p_corner_detail, 1, 20). A 0 would divide
    // by zero in the arc sweep (`pt_angle`'s `detail / (double)adapted_corner_detail`).
    expect(parseStyleBox('SubResource("StyleBoxFlat_corner_detail_too_small")', [], resources)?.cornerDetail).toBe(1);
    expect(parseStyleBox('SubResource("StyleBoxFlat_corner_detail_too_large")', [], resources)?.cornerDetail).toBe(20);
  });

  it('falls back content_margin to the matching border_width when content_margin is absent (the -1 sentinel)', () => {
    // style_box.cpp::get_margin: content_margin[side] < 0 (default -1) reads
    // through get_style_margin(side), which StyleBoxFlat overrides to return
    // border_width[side] (style_box_flat.cpp::get_style_margin).
    const box = parseStyleBox('SubResource("StyleBoxFlat_border_only")', [], resources);
    expect(box?.contentMargin).toEqual({ left: 3, top: 3, right: 3, bottom: 3 });
  });

  it('degrades to null for an absent (undefined) ref rather than throwing', () => {
    expect(parseStyleBox(undefined, [], resources)).toBeNull();
  });

  it('degrades to null for a ref that is not a resource reference at all', () => {
    expect(parseStyleBox('not-a-ref', [], resources)).toBeNull();
  });

  it('degrades to null for an ExtResource ref (only SubResources resolve)', () => {
    expect(parseStyleBox('ExtResource("1_abc")', [], resources)).toBeNull();
  });

  it('degrades to null for an unknown SubResource id', () => {
    expect(parseStyleBox('SubResource("StyleBoxFlat_nope")', [], resources)).toBeNull();
  });

  it('degrades to null when the id resolves to a non-StyleBoxFlat SubResource', () => {
    expect(parseStyleBox('SubResource("StandardMaterial3D_m")', [], resources)).toBeNull();
  });

  // `null` means "no override", and a consumer paints the default theme box. A
  // StyleBoxEmpty replaces that chrome with nothing, so it is not `null`.
  it('resolves StyleBoxEmpty to a box that paints nothing, not to null', () => {
    const box = parseStyleBox('SubResource("StyleBoxEmpty_x")', [], resources);
    expect(box).not.toBeNull();
    expect(box!.drawCenter).toBe(false);
    expect(box!.borderWidth).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    expect(box!.shadowSize).toBe(0);
  });

  // StyleBoxEmpty does not override `get_style_margin`, so an unset
  // `content_margin_<side>` falls back to the base StyleBox's 0, not a border width.
  it('gives StyleBoxEmpty zero content margin where StyleBoxFlat would fall back to its border width', () => {
    const box = parseStyleBox('SubResource("StyleBoxEmpty_x")', [], resources);
    expect(box!.contentMargin).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('honours a StyleBoxEmpty content margin authored on the StyleBox base', () => {
    const box = parseStyleBox('SubResource("StyleBoxEmpty_margins")', [], resources);
    expect(box!.contentMargin).toEqual({ left: 7, top: 0, right: 0, bottom: 3 });
  });

  it('degrades to null when the resource list is empty', () => {
    expect(parseStyleBox('SubResource("StyleBoxFlat_full")', [], [])).toBeNull();
  });

  it('resolves a StyleBoxLine SubResource to a StyleBoxFlatData-shaped wrapper carrying the parsed line', () => {
    const box = parseStyleBox('SubResource("StyleBoxLine_x")', [], resources);
    expect(box).not.toBeNull();
    expect((box as { styleBoxKind?: string }).styleBoxKind).toBe('line');
    expect((box as { line?: unknown }).line).toEqual({
      color: { r: 1, g: 0, b: 0, a: 1 },
      thickness: 2,
      vertical: true,
      growBegin: 3,
      growEnd: 4,
      margin: { left: 1, top: 0, right: 1, bottom: 0 },
    });
    // The wrapper's own contentMargin mirrors the line's effective margin, so
    // a caller doing plain minimum-size math never has to know a StyleBoxLine
    // is behind it.
    expect(box!.contentMargin).toEqual({ left: 1, top: 0, right: 1, bottom: 0 });
    // The flat core stays neutral: drawn directly (bypassing StyleBoxQuad's
    // kind dispatch), it paints nothing rather than the wrong thing.
    expect(box!.drawCenter).toBe(false);
    expect(box!.bgColor.a).toBe(0);
  });

  it('resolves a StyleBoxTexture SubResource to a StyleBoxFlatData-shaped wrapper carrying the parsed texture', () => {
    const box = parseStyleBox('SubResource("StyleBoxTexture_x")', [], resources);
    expect(box).not.toBeNull();
    expect((box as { styleBoxKind?: string }).styleBoxKind).toBe('texture');
    expect((box as { texture?: { texture?: string } }).texture?.texture).toBe('ExtResource("1_tex")');
    // texture_margin_left (5) falls through as the effective content margin
    // (no content_margin_left authored: the -1 sentinel).
    expect(box!.contentMargin).toEqual({ left: 5, top: 0, right: 0, bottom: 0 });
    expect(box!.drawCenter).toBe(false);
  });
});
