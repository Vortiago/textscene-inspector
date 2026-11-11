/**
 * The Button items the default theme gives a Control by its theme type chain. A variation the default
 * theme registers (`FlatButton`, `FlatMenuButton`) or a Label variation (`HeaderSmall`) sets some of them
 * before `Button` does (`scene/theme/default_theme.cpp:357-382`). React-free: the items are plain data.
 */

import { neutralStyleBox } from '../../../resources/styles/stylebox/decode';
import { buildThemeTypeChain } from '../../../resources/styles/theme/lookup';
import { LABEL_FONT_COLOR } from '../../../godot/scene/theme';
import { perObject } from '../../../utils/perObject';
import type { ShareNode } from './solveTree';
import type { NativeTheme } from './nativeTheme';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { Rgba } from '../../../godot/math/math';
import type { ToggleDrawState } from './buttonBase';

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
const flatButtonBoxes = perObject((theme: NativeTheme): Required<TypeBoxes> => {
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

const LABEL_BOXES: TypeBoxes = { normal: LABEL_NORMAL_BOX };

/** The boxes each type other than `Button` sets in the default theme. */
function typeBoxes(type: string, theme: NativeTheme): TypeBoxes | undefined {
  if (type === 'FlatButton' || type === 'FlatMenuButton') return flatButtonBoxes(theme);
  return type === 'Label' ? LABEL_BOXES : undefined;
}

/**
 * `Control::get_theme_stylebox` over the default theme (`theme_owner.cpp:236-245`): each box comes from the
 * first type of `typeChain` that sets it, and from `Button` where none does. A box a scene Theme sets is
 * not read here: the caller lets it win. A chain that sets none returns `Button`'s own boxes.
 */
export function buttonBoxesInChain(theme: NativeTheme, typeChain: readonly string[]): ButtonBoxes {
  let boxes: ButtonBoxes | undefined;
  const taken = new Set<BoxName>();
  for (const type of typeChain) {
    const given = typeBoxes(type, theme);
    if (!given) continue;
    boxes ??= { ...theme.widgets.button };
    for (const name of Object.keys(given) as BoxName[]) {
      if (taken.has(name)) continue;
      taken.add(name);
      boxes[name] = given[name]!;
    }
  }
  return boxes ?? theme.widgets.button;
}

/** Written only by `typeChains`. A node is replaced when the scene changes, so its chain resolves once. */
const typeChains = perObject((n: ShareNode): readonly string[] =>
  buildThemeTypeChain(
    n.node.type,
    (n.node.properties as ControlProperties).themeTypeVariation,
    n.themeChain,
    n.projectFonts.projectTheme
  )
);

/** Written only by `buttonBoxesOf`. A node's boxes build once for each theme scale. */
const boxesByTheme = perObject((_n: ShareNode) => new WeakMap<NativeTheme, ButtonBoxes>());

/** The default-theme Button boxes of `n`, by its own type and `theme_type_variation`. */
export function buttonBoxesOf(n: ShareNode, theme: NativeTheme): ButtonBoxes {
  const byTheme = boxesByTheme(n);
  let boxes = byTheme.get(theme);
  if (!boxes) {
    boxes = buttonBoxesInChain(theme, typeChains(n));
    byTheme.set(theme, boxes);
  }
  return boxes;
}

/**
 * The default theme's `font_color` for `n` in `state`: `Label` sets one (`default_theme.cpp:383`), which a
 * Button on a Label variation reads in the normal state, since Label sets no other state's colour. Else
 * `colors[state]`, the colour its own class sets. A colour a scene Theme sets is not read here.
 */
export function defaultFontColorOf(
  n: ShareNode,
  colors: Readonly<Record<ToggleDrawState, Rgba>>,
  state: ToggleDrawState
): Rgba {
  return state === 'normal' && typeChains(n).includes('Label') ? LABEL_FONT_COLOR : colors[state];
}
