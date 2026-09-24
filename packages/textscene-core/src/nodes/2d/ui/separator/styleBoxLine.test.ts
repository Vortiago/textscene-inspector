/**
 * `defaultSeparatorStyleBoxLine`: `default_theme.cpp:734-740,1063-1069` (Godot 4.6.3).
 * `native/styleBoxLine.test.ts` tests `parseStyleBoxLine`.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { defaultSeparatorStyleBoxLine } from './styleBoxLine';

describe('defaultSeparatorStyleBoxLine', () => {
  it('builds HSeparator’s separator_horizontal: not vertical, margin on left/right only', () => {
    const box = defaultSeparatorStyleBoxLine('horizontal', nativeTheme(1));
    expect(box).toEqual({
      color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      thickness: 1,
      vertical: false,
      growBegin: 1,
      growEnd: 1,
      margin: { left: 4, top: 0, right: 4, bottom: 0 },
    });
  });

  it('builds VSeparator’s separator_vertical: vertical, margin on top/bottom only', () => {
    const box = defaultSeparatorStyleBoxLine('vertical', nativeTheme(1));
    expect(box).toEqual({
      color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      thickness: 1,
      vertical: true,
      growBegin: 1,
      growEnd: 1,
      margin: { left: 0, top: 4, right: 0, bottom: 4 },
    });
  });

  it('scales the content margin with the theme (default_margin = round(4 * scale))', () => {
    const box = defaultSeparatorStyleBoxLine('horizontal', nativeTheme(2));
    expect(box.margin.left).toBe(8);
    expect(box.margin.right).toBe(8);
  });

  it('scales the line thickness with the theme (default_theme.cpp:735: round(scale))', () => {
    expect(defaultSeparatorStyleBoxLine('horizontal', nativeTheme(1.5)).thickness).toBe(2);
    expect(defaultSeparatorStyleBoxLine('horizontal', nativeTheme(3)).thickness).toBe(3);
  });
});
