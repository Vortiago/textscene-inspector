/**
 * The default theme as the records the theme walk reads: by type, then by item name, gathered once for
 * each `DefaultTheme`. Each `DefaultStyleBox` becomes the frozen `StyleBoxFlatData` a Control draws.
 */

import type {
  DefaultStyleBox,
  DefaultTheme,
  DefaultThemeType,
  Sides,
} from '../../../godot/scene/defaultTheme/defaultTheme';
import type { Rgba } from '../../../godot/math/math';
import { neutralStyleBox } from '../../../resources/styles/stylebox/decode';
import { perObject } from '../../../utils/perObject';
import { styleBoxLineBox } from './parseStyleBox';
import { flatStyleBox, freezeStyleBox, ZERO_SIDES, type StyleBoxFlatData } from './styleBoxFlat';
import { lineStyleMargin } from './styleBoxLine';

/**
 * `StyleBox::get_margin` (`style_box.cpp:78-86`) for each side: a negative (unset) margin reads
 * `styleMargin`, which is a flat box's border width and zero for an empty box.
 */
function effectiveMargin(margin: Sides, styleMargin: Sides): Sides {
  return {
    left: margin.left < 0 ? styleMargin.left : margin.left,
    top: margin.top < 0 ? styleMargin.top : margin.top,
    right: margin.right < 0 ? styleMargin.right : margin.right,
    bottom: margin.bottom < 0 ? styleMargin.bottom : margin.bottom,
  };
}

/** One drawn box for each table box, so a box two types share stays one object. */
const drawnBox = perObject((box: DefaultStyleBox): StyleBoxFlatData => {
  if (box.kind === 'empty')
    return freezeStyleBox(neutralStyleBox(effectiveMargin(box.contentMargin, ZERO_SIDES)));
  if (box.kind === 'line') {
    const { color, thickness, vertical, growBegin, growEnd } = box;
    const margin = effectiveMargin(box.contentMargin, lineStyleMargin(vertical, thickness));
    return freezeStyleBox(styleBoxLineBox({ color, thickness, vertical, growBegin, growEnd, margin }));
  }
  return freezeStyleBox(
    flatStyleBox(box.bgColor, {
      contentMargin: effectiveMargin(box.contentMargin, box.borderWidth),
      cornerRadius: box.cornerRadius,
      cornerDetail: box.cornerDetail,
      borderWidth: box.borderWidth,
      borderColor: box.borderColor,
      expandMargin: box.expandMargin,
      drawCenter: box.drawCenter,
    })
  );
});

/** Every StyleBox of `theme`, by type, then by item name. */
export const defaultStyleBoxesOf = perObject(
  (theme: DefaultTheme): Readonly<Record<string, Readonly<Record<string, StyleBoxFlatData>>>> =>
    Object.fromEntries(
      Object.entries(theme.types).map(([type, { styles }]) => [
        type,
        Object.fromEntries(Object.entries(styles).map(([name, box]) => [name, drawnBox(box)])),
      ])
    )
);

function itemsByType<K extends 'colors' | 'constants'>(
  theme: DefaultTheme,
  kind: K
): Readonly<Record<string, DefaultThemeType[K]>> {
  return Object.fromEntries(Object.entries(theme.types).map(([type, items]) => [type, items[kind]]));
}

/** Every colour of `theme`, by type, then by item name. */
export const defaultColorsOf = perObject(
  (theme: DefaultTheme): Readonly<Record<string, Readonly<Record<string, Rgba>>>> =>
    itemsByType(theme, 'colors')
);

/** Every constant of `theme`, by type, then by item name. */
export const defaultConstantsOf = perObject(
  (theme: DefaultTheme): Readonly<Record<string, Readonly<Record<string, number>>>> =>
    itemsByType(theme, 'constants')
);
