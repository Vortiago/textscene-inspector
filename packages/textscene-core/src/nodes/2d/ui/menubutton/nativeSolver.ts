/**
 * MenuButton's native rect solver. `menu_button.cpp` overrides neither `get_minimum_size` nor
 * `NOTIFICATION_DRAW`, so this assembles Button's math (`scene/gui/button.cpp:481-526`) from `buttonBase.ts`
 * again, as `optionbutton/nativeSolver.ts` does. `scene/theme/default_theme.cpp`'s "MenuButton" type
 * (`:255-272`) differs from Button's only in `font_disabled_color` (`:268`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { defineShare, type ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_LEFT,
  VERTICAL_ALIGNMENT_CENTER,
  fitIconSize,
  pickButtonStyleBox,
  resolveButtonDrawState,
  shapeButtonLabel,
  type ButtonDrawState,
} from '../../../../r3f/controls/native/buttonBase';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
} from '../../../../r3f/controls/native/textTheme';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { ControlColor } from '../control/types';
import { BUTTON_DEFAULT_FONT_COLOR, BUTTON_THEME_FONT_KEY, BUTTON_THEME_KEYS, buttonIconColor } from '../button/nativeSolver';
import type { MenuButtonProperties } from './types';

// Re-exported for Component.tsx. MenuButton registers no `icon_*_color`, so `Theme::get_color`'s
// ancestor fallback gives it Button's icon colours.
export { buttonIconColor };

/** `Color(1, 1, 1, 0.3)`: MenuButton's own disabled font colour (`default_theme.cpp:268`), not Button's `control_font_disabled_color` = `Color(0.875, 0.875, 0.875, 0.5)` (`:161`). */
export const MENU_BUTTON_DEFAULT_DISABLED_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 0.3 };

/** MenuButton's theme font size and colour for `state`: its overrides, else the ancestor Theme chain, else the theme default, else MenuButton's literal. */
export function menuButtonTextTheme(
  n: ShareNode,
  props: MenuButtonProperties,
  state: ButtonDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color: state === 'disabled' ? MENU_BUTTON_DEFAULT_DISABLED_FONT_COLOR : BUTTON_DEFAULT_FONT_COLOR,
  };
  return resolveTextTheme(n, props, BUTTON_THEME_KEYS[state], defaults);
}

/**
 * MenuButton's shaped label, null for empty text: the solve-handoff share
 * (`r3f/controls/native/solveHandoff.ts`) of `menuButtonMinimumSize` and `Component.tsx`.
 */
export const menuButtonLabelShape = defineShare<TextLayoutResult | null>((n, theme) => {
  const props = n.node.properties as MenuButtonProperties;
  const text = props.text ?? '';
  if (text.length === 0) return null;
  const state = resolveButtonDrawState(props.disabled);
  const { fontSizePx } = menuButtonTextTheme(n, props, state, { theme });
  return shapeButtonLabel(text, fontSizePx, resolveNodeFontMetrics(n, BUTTON_THEME_FONT_KEY));
});

/**
 * `Button::get_minimum_size_for_text_and_icon` (`button.cpp:481-526`), the math `buttonMinimumSize` ports,
 * with the same omissions: `align_to_largest_stylebox` and autowrap sizing.
 */
export const menuButtonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as MenuButtonProperties;
  const state = resolveButtonDrawState(props.disabled);
  const styleBox = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.button, state, n.rtl);
  const { x: marginX, y: marginY } = contentMarginSize(styleBox);

  const hasText = (props.text ?? '').length > 0;
  const layout: TextLayoutResult | null = ctx.measureText ? menuButtonLabelShape(n, ctx.theme) : null;
  const textSize = layout
    ? { x: shapedTextSizeWidthPx(layout.widthPx), y: layout.heightPx }
    : { x: 0, y: 0 };

  let width = textSize.x;
  let height = textSize.y;

  const iconAlignment = props.iconAlignment ?? HORIZONTAL_ALIGNMENT_LEFT;
  const verticalIconAlignment = props.verticalIconAlignment ?? VERTICAL_ALIGNMENT_CENTER;
  const iconMaxWidth = n.constants.icon_max_width ?? 0;
  const hSeparation = n.constants.h_separation ?? ctx.theme.separation;

  if (!props.expandIcon && n.textureSize && n.textureSize.x > 0 && n.textureSize.y > 0) {
    const iconSize = fitIconSize(n.textureSize, iconMaxWidth);

    if (verticalIconAlignment === VERTICAL_ALIGNMENT_CENTER) {
      height = Math.max(height, iconSize.y);
    } else {
      height += iconSize.y;
    }

    if (iconAlignment !== HORIZONTAL_ALIGNMENT_CENTER) {
      width += iconSize.x;
      if (hasText) width += Math.max(0, hSeparation);
    } else {
      width = Math.max(width, iconSize.x);
    }
  }

  if (hasText) {
    if (verticalIconAlignment === VERTICAL_ALIGNMENT_CENTER) {
      height = Math.max(textSize.y, height);
    } else {
      height += textSize.y;
    }
  }

  return { x: marginX + width, y: marginY + height };
};
