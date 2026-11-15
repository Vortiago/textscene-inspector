/**
 * What OptionButton adds to Button (`scene/gui/option_button.cpp`): the selected item as Button's text and
 * icon (`:423-424`), the arrow it reserves as Button's `_internal_margin` (`:83-89,139-147`) and draws over
 * it (`:91-135`), and its minimum size (`:50-68`, `:445-456`), with the table's
 * `OptionButton` items as defaults.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type {
  MinimumSizeFn,
  SolveContext,
  TextureSlotRequest,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { themedSlotRequest } from '../../../../r3f/controls/native/solverRegistry';
import type { ShareNode, SolveNode } from '../../../../r3f/controls/native/solveTree';
import { contentMarginSize, sidesSize } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  isButtonNodeAutowrapped,
  measuredContentMinimumSize,
  resolveToggleDrawState,
} from '../../../../r3f/controls/native/buttonBase';
import { WHITE_MODULATE } from '../../../../r3f/canvasItemModulate';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { themedIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Rgba } from '../../../../godot/math/math';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { OptionButtonProperties, OptionItem } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import {
  BUTTON_THEME_FONT_KEY,
  buttonContentFacts,
  buttonHSeparation,
  buttonLargestMargin,
  buttonMinimumSizeOf,
  buttonNormalBox,
  buttonShown,
  buttonTextTheme,
  buttonTextureSlotsOf,
  type ReservingButtonClass,
} from '../button/nativeSolver';

/** The item `_select` copies the text and icon from (`option_button.cpp:423-424`), or none for an absent or out-of-range `selected`. */
function selectedOptionItem(props: OptionButtonProperties): OptionItem | undefined {
  const items = props.items ?? [];
  const selectedIndex = props.selected ?? -1;
  return selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : undefined;
}

/** `option_button_arrow.svg`'s authored size (`native/themeIcons.ts`), 12x12. The default theme rasterises it at the theme scale. */
const OPTION_BUTTON_ARROW_NATURAL_SIZE: Vector2 = { x: 12, y: 12 };

/** The slot of item `index`'s own icon, which `_refresh_size_cache` sizes the button by (`option_button.cpp:451`). */
function optionItemIconSlotKey(index: number): string {
  return `popup/item_${index}/icon`;
}

/**
 * `get_minimum_size` and `_notification` read `theme_cache.arrow_icon->get_size()` directly
 * (`option_button.cpp:62,131-133`), never through `_fit_icon_size` or `icon_max_width`, so a themed arrow
 * changes the reserved width and the draw position. The vendored size at the theme scale is the fallback.
 */
function optionButtonArrowSize(n: Pick<SolveNode, 'textureSlots'>, theme: NativeTheme): Vector2 {
  return themedIconSize(n.textureSlots, 'arrow', OPTION_BUTTON_ARROW_NATURAL_SIZE, theme.scale);
}

/**
 * OptionButton as a Button: its font colours equal Button's in the table, its constructor
 * aligns the text LEFT (`option_button.cpp:654`), `_select` gives Button the selected item's text and icon
 * (`:423-424`), and the arrow is the internal margin of the trailing side (`:83-89,139-147`).
 */
export const OPTION_BUTTON_CLASS: ReservingButtonClass = {
  textAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
  // With no item selected, `_select` never runs and Button keeps its own text and icon
  // (`option_button.cpp:432-442`).
  shown: (props) => {
    const selected = selectedOptionItem(props);
    if (!selected) return { text: props.text ?? '', icon: props.icon };
    return { text: selected.text, icon: selected.icon };
  },
  reservedElement: (n, theme) => ({ side: n.rtl ? 'left' : 'right', size: optionButtonArrowSize(n, theme) }),
};

/**
 * The selected item's icon as Button's `icon` (`option_button.cpp:424`), then every item's own icon, then
 * the themeable `arrow` (`BIND_THEME_ITEM_CUSTOM(... "arrow")`, `:620`).
 */
export const optionButtonTextureSlots: TextureSlotsFn = buttonTextureSlotsOf(
  OPTION_BUTTON_CLASS,
  (node, themedIcons = {}) => {
    const requests: TextureSlotRequest[] = [];
    for (const [index, { icon }] of ((node.properties as OptionButtonProperties).items ?? []).entries()) {
      if (icon) requests.push({ key: optionItemIconSlotKey(index), ref: icon });
    }
    if (themedIcons.arrow) requests.push(themedSlotRequest('arrow', themedIcons.arrow));
    return requests;
  }
);

const buttonMinimumSize = buttonMinimumSizeOf(OPTION_BUTTON_CLASS);

/**
 * `_cached_size` (`option_button.cpp:445-456`): the widest and tallest item, each through
 * `Button::get_minimum_size_for_text_and_icon` with its own text and icon, floored at the `normal` box's
 * minimum size.
 */
function longestItemMinimumSize(n: SolveNode, ctx: SolveContext): Vector2 {
  const props = n.node.properties as OptionButtonProperties;
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);
  const { fontSizePx } = buttonTextTheme(n, props, state);
  const fontMetrics = resolveNodeFontMetrics(n, BUTTON_THEME_FONT_KEY);

  // The facts only an item's text and icon change, and equal texts measure alike.
  const buttonFacts = buttonContentFacts(n, ctx.theme, OPTION_BUTTON_CLASS, { x: 0, y: 0 });
  const padding = sidesSize(buttonFacts.styleMargin);
  const measuredByText = new Map<string, Vector2>();
  // An empty item text keeps the button's own paragraph, the selected item's text (`button.cpp:485-486`).
  const selectedText = buttonShown(OPTION_BUTTON_CLASS, props).text;
  const measure = (itemText: string): Vector2 => {
    const text = itemText || selectedText;
    if (!ctx.measureText || !text) return { x: 0, y: 0 };
    const known = measuredByText.get(text);
    if (known) return known;
    const size = ctx.measureText(text, fontSizePx, 0, fontMetrics);
    measuredByText.set(text, size);
    return size;
  };

  const longest = contentMarginSize(buttonNormalBox(n));
  for (const [index, { text }] of (props.items ?? []).entries()) {
    // `paragraph->get_size()` is ceiled (`text_paragraph.cpp:601-608` -> `text_server_adv.cpp:7524-7537`),
    // so the max is over whole-pixel widths. `clip_text`, a trimming overrun or autowrap zeroes the
    // width (`button.cpp:493-495`). An item shapes a fresh paragraph (`button.cpp:484-489`) and only the
    // draw sets a width, on `text_buf` (`button.cpp:432`), so an item never wraps.
    const facts = {
      ...buttonFacts,
      hasText: text.length > 0 || selectedText.length > 0,
      iconNaturalSize: n.textureSlots[optionItemIconSlotKey(index)] ?? null,
    };
    const content = measuredContentMinimumSize(facts, measure(text), props);
    longest.x = Math.max(longest.x, padding.x + content.x);
    longest.y = Math.max(longest.y, padding.y + content.y);
  }
  return longest;
}

/** `fit_to_longest_item`, true unless the scene clears it (`option_button.h`). */
function fitsToLongestItem(n: ShareNode): boolean {
  return (n.node.properties as OptionButtonProperties).fitToLongestItem !== false;
}

/** Whether the minimum size reads the node's own width: a wrapping label, which only `fit_to_longest_item` off measures (`option_button.cpp:52-56`). */
export function isOptionButtonSizeDependent(n: SolveNode): boolean {
  return !fitsToLongestItem(n) && isButtonNodeAutowrapped(n);
}

/**
 * `OptionButton::get_minimum_size` (`option_button.cpp:50-68`): the longest item, or Button's own minimum
 * with `fit_to_longest_item` off, plus the arrow width and `h_separation` unconditionally, inside the
 * largest box of any draw state. CheckBox's `if (content_size.width > 0 ...)` guard has no counterpart here.
 */
export const optionButtonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const minimumSize = fitsToLongestItem(n) ? longestItemMinimumSize(n, ctx) : buttonMinimumSize(n, ctx);
  const padding = sidesSize(buttonLargestMargin(n));
  const arrow = optionButtonArrowSize(n, ctx.theme);
  const hSeparation = Math.max(0, buttonHSeparation(n));
  return {
    x: minimumSize.x + arrow.x + hSeparation,
    y: Math.max(minimumSize.y - padding.y, arrow.y) + padding.y,
  };
};

/**
 * Where `OptionButton::_notification` draws the arrow in a box of `rectSize` (`option_button.cpp:122-131`):
 * `arrow_margin` from the trailing edge of the whole control, not of the content, and from the leading
 * edge under RTL. `int()` truncates the vertical centring.
 */
export function optionButtonArrowRect(n: ShareNode, theme: NativeTheme, rectSize: Vector2): Rect2 {
  const arrowSize = optionButtonArrowSize(n, theme);
  const arrowMargin = requiredThemeItem(n.constants, 'arrow_margin');
  return {
    x: Math.floor(n.rtl ? arrowMargin : rectSize.x - arrowSize.x - arrowMargin),
    y: Math.floor(Math.abs((rectSize.y - arrowSize.y) / 2)),
    w: arrowSize.x,
    h: arrowSize.y,
  };
}

/**
 * The arrow's modulate (`option_button.cpp:98-118`): white, or the label's font colour of the draw state
 * where the theme sets `modulate_arrow`, which the table's `OptionButton/modulate_arrow` leaves off.
 */
export function optionButtonArrowColor(n: ShareNode): Rgba {
  if (!requiredThemeItem(n.constants, 'modulate_arrow')) return WHITE_MODULATE;
  const props = n.node.properties as OptionButtonProperties;
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);
  return buttonTextTheme(n, props, state).color;
}
