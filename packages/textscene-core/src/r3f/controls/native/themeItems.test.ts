/**
 * The items a Control reads when the default theme table answers last (`theme_owner.cpp:227-261`): a type
 * variation reads its own items, then its base's, and a scene Theme wins over the table for an item it sets.
 */
import { describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import { NO_PROJECT_FONTS } from '../../../resources/fonts/font/projectFonts';
import { themeResolutionScope } from '../../../resources/styles/theme/lookup';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import { controlNode } from './testing/solveNode';
import { themeResource } from './testing/themeResource';
import { isDrawn } from './styleBoxFlat';
import { resolveStyleBoxes, resolveThemedColors } from './themeItems';

const NO_SCOPE = { externalResources: [], internalResources: [] };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const NO_MARGIN = { left: 0, top: 0, right: 0, bottom: 0 };

function buttonItems(variation?: string, themes: readonly ThemeResource[] = []) {
  const node = controlNode('B', 'Button', { name: 'B', themeTypeVariation: variation });
  const scope = themeResolutionScope('Button', variation, themes, NO_PROJECT_FONTS);
  return { styleBoxes: resolveStyleBoxes(node, NO_SCOPE, scope), colors: resolveThemedColors(node, scope) };
}

describe('the default theme table under a type variation', () => {
  it('gives a Button on HeaderSmall the empty `normal` box of Label, with no margin (default_theme.cpp:379)', () => {
    const { normal } = buttonItems('HeaderSmall').styleBoxes;
    expect([isDrawn(normal!), normal!.contentMargin]).toEqual([false, NO_MARGIN]);
  });

  it("keeps Button's `pressed` box for a Button on HeaderSmall, which Label sets none for", () => {
    expect(buttonItems('HeaderSmall').styleBoxes.pressed).toBe(buttonItems().styleBoxes.pressed);
  });

  it("gives a Button on HeaderSmall Label's white `font_color` before Button's", () => {
    expect(buttonItems('HeaderSmall').colors.font_color).toEqual(WHITE);
  });

  it('reads FlatButton through a variation that only a scene Theme registers', () => {
    const theme = themeResource({ typeVariations: { MyFlat: 'FlatButton' } });
    expect(isDrawn(buttonItems('MyFlat', [theme]).styleBoxes.normal!)).toBe(false);
  });

  it("gives Button's own boxes for a variation that no Theme registers", () => {
    expect(buttonItems('NoSuchVariation').styleBoxes).toEqual(buttonItems().styleBoxes);
  });
});

describe('a scene Theme over the default theme table', () => {
  const redBox: TscnInternalResource = {
    id: 'red',
    type: 'StyleBoxFlat',
    data: { bg_color: 'Color(1, 0, 0, 1)' },
  };
  const theme = themeResource({
    styles: { FlatButton: { pressed: 'SubResource("red")' } },
    resources: { externalResources: [], internalResources: [redBox] },
  });

  it('wins for the item it sets', () => {
    expect(buttonItems('FlatButton', [theme]).styleBoxes.pressed!.bgColor).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    });
  });

  it('leaves every other item to the table', () => {
    expect(buttonItems('FlatButton', [theme]).styleBoxes.normal).toBe(
      buttonItems('FlatButton').styleBoxes.normal
    );
  });
});
