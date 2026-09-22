/**
 * `parseStyleBoxLine` — `style_box_line.h`/`.cpp` (Godot 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import { parseStyleBoxLine } from './styleBoxLine';

const resources: TscnInternalResource[] = [
  {
    id: 'Line_full',
    type: 'StyleBoxLine',
    data: {
      color: 'Color(1, 0, 0, 1)',
      thickness: '2',
      vertical: 'true',
      grow_begin: '3',
      grow_end: '4',
      content_margin_left: '5',
      content_margin_top: '6',
      content_margin_right: '7',
      content_margin_bottom: '8',
    },
  },
  { id: 'Line_empty', type: 'StyleBoxLine', data: {} },
  { id: 'StyleBoxFlat_x', type: 'StyleBoxFlat', data: {} },
];

describe('parseStyleBoxLine', () => {
  it('resolves every authored field from a SubResource ref', () => {
    const box = parseStyleBoxLine('SubResource("Line_full")', resources);
    expect(box).toEqual({
      color: { r: 1, g: 0, b: 0, a: 1 },
      thickness: 2,
      vertical: true,
      growBegin: 3,
      growEnd: 4,
      margin: { left: 5, top: 6, right: 7, bottom: 8 },
    });
  });

  it('falls back to style_box_line.h defaults for an unset field, resolving margin via get_style_margin (horizontal)', () => {
    // style_box_line.cpp:33-43: vertical=false → thickness/2 on top/bottom, 0 on left/right.
    const box = parseStyleBoxLine('SubResource("Line_empty")', resources);
    expect(box).toEqual({
      color: { r: 0, g: 0, b: 0, a: 1 },
      thickness: 1,
      vertical: false,
      growBegin: 1,
      growEnd: 1,
      margin: { left: 0, top: 0.5, right: 0, bottom: 0.5 },
    });
  });

  it('resolves margin via get_style_margin on the vertical axis when the box is vertical', () => {
    const vertical: TscnInternalResource[] = [
      { id: 'Line_v', type: 'StyleBoxLine', data: { vertical: 'true', thickness: '4' } },
    ];
    const box = parseStyleBoxLine('SubResource("Line_v")', vertical);
    expect(box?.margin).toEqual({ left: 2, top: 0, right: 2, bottom: 0 });
  });

  it('returns null for an absent ref, a non-SubResource form, and a resource of a different type', () => {
    expect(parseStyleBoxLine(undefined, resources)).toBeNull();
    expect(parseStyleBoxLine('ExtResource("Line_full")', resources)).toBeNull();
    expect(parseStyleBoxLine('SubResource("StyleBoxFlat_x")', resources)).toBeNull();
    expect(parseStyleBoxLine('SubResource("missing")', resources)).toBeNull();
  });
});
