/** `defaultThemeRecords.ts`: the drawn boxes the theme walk hands a Control. */
import { describe, expect, it } from 'vitest';
import { defaultThemeAt } from '../../../godot/scene/defaultTheme/defaultTheme';
import { defaultColorsOf, defaultStyleBoxesOf } from './defaultThemeRecords';

describe('defaultStyleBoxesOf', () => {
  it('freezes a drawn box, so a reader cannot edit the margins another reader sees', () => {
    const margin = defaultStyleBoxesOf(defaultThemeAt(1)).FlatMenuButton!.normal!.contentMargin as {
      left: number;
    };
    expect(() => {
      margin.left += 1;
    }).toThrow(TypeError);
  });

  it('gives two items that share one box one drawn object', () => {
    const boxes = defaultStyleBoxesOf(defaultThemeAt(1));
    expect(boxes.PopupMenu!.labeled_separator_left).toBe(boxes.PopupMenu!.separator);
  });
});

describe('defaultColorsOf', () => {
  it('freezes a colour the table derives from white, as it freezes white itself', () => {
    const grid = defaultColorsOf(defaultThemeAt(1)).GraphEdit!.grid_minor! as { a: number };
    expect(() => {
      grid.a = 1;
    }).toThrow(TypeError);
  });
});
