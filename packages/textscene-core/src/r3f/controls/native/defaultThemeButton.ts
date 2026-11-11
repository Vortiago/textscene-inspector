/**
 * The Button items the default theme gives a Control by its theme type chain. A variation the default
 * theme registers (`FlatButton`, `FlatMenuButton`) or a Label variation (`HeaderSmall`) sets some of them
 * before `Button` does (`scene/theme/default_theme.cpp:357-382`). React-free: the items are plain data.
 */

import { neutralStyleBox } from '../../../resources/styles/stylebox/decode';
import { themeResolutionScope } from '../../../resources/styles/theme/lookup';
import { perObject } from '../../../utils/perObject';
import type { ShareNode } from './solveTree';
import type { NativeTheme } from './nativeTheme';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { Rgba } from '../../../godot/math/math';
import { LABEL_DEFAULT_FONT_COLOR } from '../../../nodes/2d/ui/label/nativeSolver';

/** The boxes a Button draws by draw state: `NativeTheme`'s own, or the default theme's for a variation. */
export type ButtonBoxes = NativeTheme['widgets']['button'];

type BoxName = 'normal' | 'hover' | 'pressed' | 'disabled';

/** The boxes a type sets in the default theme, which `Button` would otherwise set. */
type TypeBoxes = Readonly<Partial<Record<BoxName, StyleBoxFlatData>>>;

/** `flat_button_pressed` (`default_theme.cpp:363-364`): `button_pressed` with `style_pressed_color * Color(1, 1, 1, 0.85)`. */
const PRESSED_ALPHA = 0.85;

/**
 * The boxes of `FlatButton` and `FlatMenuButton` (`default_theme.cpp:366-375`), built once per theme: an empty
 * box that keeps `button_normal`'s margins, which `widgets.flatMenuButton` holds, and a darker pressed box.
 */
export const flatButtonBoxes = perObject((theme: NativeTheme): Required<TypeBoxes> => {
  const { normal: empty, disabled } = theme.widgets.flatMenuButton;
  const { pressed } = theme.widgets.button;
  return {
    normal: empty,
    hover: empty,
    disabled,
    pressed: { ...pressed, bgColor: { ...pressed.bgColor, a: pressed.bgColor.a * PRESSED_ALPHA } },
  };
});

/** `Label`'s `normal`, a `StyleBoxEmpty` with no margin (`default_theme.cpp:379`): a Button on a Label variation reads it. */
export const LABEL_NORMAL_BOX = neutralStyleBox({ left: 0, top: 0, right: 0, bottom: 0 });

/** Every type that sets a Button box in the default theme and is not `Button` itself. */
const TYPE_BOXES: Readonly<Record<string, (theme: NativeTheme) => TypeBoxes>> = {
  FlatButton: flatButtonBoxes,
  FlatMenuButton: flatButtonBoxes,
  Label: () => ({ normal: LABEL_NORMAL_BOX }),
};

const BOX_NAMES: readonly BoxName[] = ['normal', 'hover', 'pressed', 'disabled'];

/**
 * `Control::get_theme_stylebox` over the default theme (`theme_owner.cpp:236-245`): each box comes from the
 * first type of `typeChain` that sets it, and from `Button` where none does. A box a scene Theme sets is
 * not read here: the caller lets it win.
 */
export function buttonBoxesInChain(theme: NativeTheme, typeChain: readonly string[]): ButtonBoxes {
  const boxes = { ...theme.widgets.button };
  for (const name of BOX_NAMES) {
    for (const type of typeChain) {
      const given = Object.hasOwn(TYPE_BOXES, type) ? TYPE_BOXES[type]!(theme)[name] : undefined;
      if (!given) continue;
      boxes[name] = given;
      break;
    }
  }
  return boxes;
}

/** Written only by `typeChainOf`. A node is replaced when the scene changes, so its chain resolves once. */
const typeChains = perObject(
  (n: ShareNode): readonly string[] =>
    themeResolutionScope(
      n.node.type,
      (n.node.properties as ControlProperties).themeTypeVariation,
      n.themeChain,
      n.projectFonts
    ).typeChain
);

/** Written only by `buttonBoxesOf`. */
const boxesOfNode = perObject((_node: ShareNode) => new WeakMap<NativeTheme, ButtonBoxes>());

/** The default-theme Button boxes of `n`, by its own type and `theme_type_variation`. */
export function buttonBoxesOf(n: ShareNode, theme: NativeTheme): ButtonBoxes {
  const byTheme = boxesOfNode(n);
  const known = byTheme.get(theme);
  if (known) return known;
  const boxes = buttonBoxesInChain(theme, typeChains(n));
  byTheme.set(theme, boxes);
  return boxes;
}

/** `Label`'s `font_color` (`default_theme.cpp:383`), which a Button on a Label variation reads before its own. */
const TYPE_FONT_COLORS: Readonly<Record<string, Rgba>> = { Label: LABEL_DEFAULT_FONT_COLOR };

/**
 * The default theme's `font_color` for `n`: the first type of its chain that sets one, else `fallback`,
 * the colour its own class sets. A colour a scene Theme sets is not read here: the caller lets it win.
 */
export function defaultFontColorOf(n: ShareNode, fallback: Rgba): Rgba {
  for (const type of typeChains(n)) {
    if (Object.hasOwn(TYPE_FONT_COLORS, type)) return TYPE_FONT_COLORS[type]!;
  }
  return fallback;
}
