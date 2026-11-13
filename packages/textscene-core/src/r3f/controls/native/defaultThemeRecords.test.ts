/** `defaultThemeRecords.ts`: the drawn boxes the theme walk hands a Control. */
import { describe, expect, it } from 'vitest';
import { defaultThemeAt } from '../../../godot/scene/defaultTheme/defaultTheme';
import { defaultStyleBoxesOf } from './defaultThemeRecords';

describe('defaultStyleBoxesOf', () => {
  it('freezes a drawn box, so a reader cannot edit the margins another reader sees', () => {
    const margin = defaultStyleBoxesOf(defaultThemeAt(1)).FlatMenuButton!.normal!.contentMargin as {
      left: number;
    };
    expect(() => {
      margin.left += 1;
    }).toThrow(TypeError);
  });

  it('gives a box two types share one drawn object', () => {
    const boxes = defaultStyleBoxesOf(defaultThemeAt(1));
    expect(boxes.PopupMenu!.labeled_separator_left).toBe(boxes.PopupMenu!.separator);
  });
});
