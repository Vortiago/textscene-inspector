/**
 * The check icon sizes of a PopupMenu theme: the vendored 16x16 icons scaled by the theme scale,
 * or the size of a themed texture.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { popupMenuTheme } from './menuTheme';
import { minimumCheckSize, widestCheckIcon } from './menuItems';
import { menu } from './testing/menuNode';

describe('the check icon sizes', () => {
  it('scale the vendored 16x16 icon by the theme scale', () => {
    const theme = popupMenuTheme(menu([]), nativeTheme(1.5));
    expect(theme.checkIconSizes.checked).toEqual({ x: 24, y: 24 });
    expect(theme.checkIconSizes.radioUnchecked).toEqual({ x: 24, y: 24 });
  });

  it('drive the minimum check size and the widest check icon', () => {
    const theme = popupMenuTheme(menu([]), nativeTheme(2));
    expect(minimumCheckSize(theme)).toEqual({ x: 32, y: 32 });
    expect(widestCheckIcon(theme)).toBe(32);
  });

  it('keep the size of a themed texture whatever the theme scale', () => {
    const node = { ...menu([]), textureSlots: { checked: { x: 10, y: 12 } } };
    const theme = popupMenuTheme(node, nativeTheme(2));
    expect(theme.checkIconSizes.checked).toEqual({ x: 10, y: 12 });
  });
});
