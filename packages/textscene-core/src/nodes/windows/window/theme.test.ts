import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { STYLE_FILL } from '../../../godot/scene/theme';
import { windowThemeDefaults } from './theme';

describe('windowThemeDefaults — the default theme’s Window items (`default_theme.cpp:672-688`)', () => {
  it('borders a focused window with the popup colour and an unfocused one with the popup hover colour', () => {
    const defaults = windowThemeDefaults(nativeTheme(1));
    expect(defaults.embeddedBorder.bgColor).toEqual(STYLE_FILL.popup);
    expect(defaults.embeddedUnfocusedBorder.bgColor).toEqual(STYLE_FILL.popupHover);
  });

  it('grows the border past the window by the expand margins, the title band on top', () => {
    const { embeddedBorder } = windowThemeDefaults(nativeTheme(1));
    expect(embeddedBorder.expandMargin).toEqual({ left: 8, top: 32, right: 8, bottom: 6 });
    expect(embeddedBorder.contentMargin).toEqual({ left: 10, top: 28, right: 10, bottom: 8 });
  });

  it('rounds each scaled margin on its own, as `make_flat_stylebox` and `sb_expand` do', () => {
    const { embeddedBorder } = windowThemeDefaults(nativeTheme(1.5));
    expect(embeddedBorder.expandMargin).toEqual({ left: 12, top: 48, right: 12, bottom: 9 });
    expect(embeddedBorder.contentMargin).toEqual({ left: 15, top: 42, right: 15, bottom: 12 });
  });

  it('truncates the scaled title and close constants into an int, as `set_constant` does', () => {
    const defaults = windowThemeDefaults(nativeTheme(1.25));
    expect(defaults.titleHeight).toBe(45);
    expect(defaults.closeHOffset).toBe(22);
    expect(defaults.closeVOffset).toBe(30);
  });

  it('draws no title outline by default', () => {
    const defaults = windowThemeDefaults(nativeTheme(1));
    expect(defaults.titleOutlineSize).toBe(0);
    expect(defaults.titleOutlineModulate).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});
