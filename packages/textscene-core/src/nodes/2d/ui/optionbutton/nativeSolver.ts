/**
 * OptionButton's native rect solver and content layout: `get_minimum_size`, `_refresh_size_cache` and
 * `_notification` (`scene/gui/option_button.cpp`), with the defaults `scene/theme/default_theme.cpp:212-251`
 * registers for "OptionButton". A static preview has no pointer or open popup, so `get_draw_mode()` gives
 * `DRAW_NORMAL`, `DRAW_DISABLED`, or `DRAW_PRESSED` for an authored `button_pressed` (`base_button.cpp:326-352`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type {
  MinimumSizeFn,
  SolveContext,
  TextureSlotRequest,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { themedSlotRequest } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  BUTTON_THEME_KEYS,
  buttonIconSlotRequests,
  internalMarginAt,
  layoutButtonContent,
  measuredContentMinimumSize,
  pickButtonStyleBox,
  resolveToggleDrawState,
  tintColor,
  type ButtonContentFacts,
  type ButtonContentInput,
  type ButtonContentLayout,
  type ToggleDrawState,
} from '../../../../r3f/controls/native/buttonBase';
import type { Rect2 } from '../../../../godot/math/rect2';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
} from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { OptionButtonProperties, OptionItem } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { BUTTON_DEFAULT_FONT_COLORS, derivedButtonContentFacts } from '../button/nativeSolver';

// Re-exported so Component.tsx imports the Button draw-state pieces under one name.
export { pickButtonStyleBox, resolveToggleDrawState, tintColor };

/**
 * OptionButton's own theme font key, `SceneStringName(font)` (`scene/theme/default_theme.cpp:237`). This
 * module and `Component.tsx` both pass it to `resolveNodeFontMetrics`, so they shape in the same font.
 */
export const OPTION_BUTTON_THEME_FONT_KEY = 'font';

/**
 * OptionButton's theme font size and colour for `state`: its overrides, else the ancestor Theme chain, else the
 * theme default, else OptionButton's literal (`resolveTextTheme`). Its literals (`default_theme.cpp:240-245`)
 * equal Button's, so it reads Button's tables.
 */
export function optionButtonTextTheme(
  n: SolveNode,
  props: OptionButtonProperties,
  state: ToggleDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color: BUTTON_DEFAULT_FONT_COLORS[state],
  };
  return resolveTextTheme(n, props, BUTTON_THEME_KEYS[state], defaults);
}

// StyleBox chrome
// OptionButton's chrome (`default_theme.cpp:212-215`) has `2*default_margin` by `default_margin` content
// margins, unlike Button's (`theme.optionButtonMarginX/Y`). `nativeTheme.ts` builds it once per theme as
// `theme.widgets.optionButton`, so solve and paint share one struct and `StyleBoxQuad` keeps its geometry.

// Selected item

/** The item `_select` copies the text and icon from (`option_button.cpp:423-424`), or none for an absent or out-of-range `selected`. */
export function selectedOptionItem(props: OptionButtonProperties): OptionItem | undefined {
  const items = props.items ?? [];
  const selectedIndex = props.selected ?? -1;
  return selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : undefined;
}

// Arrow

/** `option_button_arrow.svg`'s authored size (`native/themeIcons.ts`), 12x12, never run through `_fit_icon_size`. */
const OPTION_BUTTON_ARROW_NATURAL_SIZE: Vector2 = { x: 12, y: 12 };

/** The slot of item `index`'s own icon, which `_refresh_size_cache` sizes the button by (`option_button.cpp:451`). */
function optionItemIconSlotKey(index: number): string {
  return `popup/item_${index}/icon`;
}

/**
 * The selected item's icon as Button's `icon` (`option_button.cpp:424`), first because it is `textureSize`, then
 * every item's own icon, then the themeable `arrow` (`BIND_THEME_ITEM_CUSTOM(... "arrow")`, `:620`).
 */
export const optionButtonTextureSlots: TextureSlotsFn = (node, themedIcons = {}) => {
  const props = node.properties as OptionButtonProperties;
  const selectedIcon = selectedOptionItem(props)?.icon;
  const requests: TextureSlotRequest[] = buttonIconSlotRequests(selectedIcon);
  for (const [index, { icon }] of (props.items ?? []).entries()) {
    if (icon) requests.push({ key: optionItemIconSlotKey(index), ref: icon });
  }
  const themed = themedIcons.arrow;
  if (themed) requests.push(themedSlotRequest('arrow', themed));
  return requests;
};

/**
 * `get_minimum_size` and `_notification` read `theme_cache.arrow_icon->get_size()` directly
 * (`option_button.cpp:62,131-133`), never through `_fit_icon_size` or `icon_max_width`, so a themed arrow
 * changes the reserved width and the draw position. The vendored size is the fallback.
 */
export function optionButtonArrowSize(n: Pick<SolveNode, 'textureSlots'>): Vector2 {
  return n.textureSlots.arrow ?? OPTION_BUTTON_ARROW_NATURAL_SIZE;
}

/** `h_separation`: OptionButton's default (`default_theme.cpp:249`, `round(4*scale)`) equals `theme.separation`. */
function optionButtonHSeparation(
  constants: SolveNode['constants'],
  ctx: Pick<SolveContext, 'theme'>
): number {
  return Math.max(0, constants.h_separation ?? ctx.theme.separation);
}

/**
 * What `layoutButtonContent` reads of an OptionButton showing `text` and `iconNaturalSize`: the arrow
 * reserved as the internal margin on the trailing side (`option_button.cpp:83-89,139-147`), and Button's
 * own `icon`, which `_select` sets from the selected item (`:424`).
 */
export function optionButtonContentFacts(
  n: Pick<SolveNode, 'styleBoxes' | 'textureSlots' | 'constants' | 'rtl'>,
  props: OptionButtonProperties,
  text: string,
  ctx: Pick<SolveContext, 'theme'>,
  rectSize: Vector2,
  iconNaturalSize: Vector2 | null
): ButtonContentFacts {
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);
  const styleBox = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.optionButton, state, n.rtl);
  return derivedButtonContentFacts({
    n,
    props,
    text,
    ctx,
    rectSize,
    iconNaturalSize,
    styleMargin: styleBox.contentMargin,
    internalMargin: internalMarginAt(n.rtl ? 'left' : 'right', optionButtonArrowSize(n).x),
  });
}

// Minimum size

/**
 * `OptionButton::get_minimum_size` (`option_button.cpp:50-68`) at `fit_to_longest_item` true (`option_button.h`),
 * which is not parsed: the widest and tallest item, each with its own icon (`_refresh_size_cache`,
 * `:446-453`), with the stylebox minimum, plus the arrow width and `h_separation` unconditionally.
 * CheckBox's `if (content_size.width > 0 ...)` guard has no counterpart here.
 */
export const optionButtonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as OptionButtonProperties;
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);
  const styleBox = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.optionButton, state, n.rtl);
  const { x: marginX, y: marginY } = contentMarginSize(styleBox);

  const { fontSizePx } = optionButtonTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, OPTION_BUTTON_THEME_FONT_KEY);
  const items = props.items ?? [];

  // The facts only an item's text and icon change, and equal texts measure alike.
  const itemFacts = optionButtonContentFacts(n, props, '', ctx, { x: 0, y: 0 }, null);
  const measuredByText = new Map<string, Vector2>();
  // An empty item text keeps the button's own paragraph, the selected item's text (`button.cpp:485-486`).
  const selectedText = selectedOptionItem(props)?.text ?? '';
  const measure = (itemText: string): Vector2 => {
    const text = itemText || selectedText;
    if (!ctx.measureText || !text) return { x: 0, y: 0 };
    const known = measuredByText.get(text);
    if (known) return known;
    const size = ctx.measureText(text, fontSizePx, 0, fontMetrics);
    measuredByText.set(text, size);
    return size;
  };

  let itemW = 0;
  let itemH = 0;
  for (const [index, { text }] of items.entries()) {
    // Each item goes through `Button::get_minimum_size_for_text_and_icon` (`button.cpp:492`), whose
    // `paragraph->get_size()` is ceiled (`text_paragraph.cpp:601-608` -> `text_server_adv.cpp:7524-7537`),
    // so the max is over whole-pixel widths.
    // `clip_text`, a trimming overrun or autowrap zeroes the width (`button.cpp:493-495`). An item shapes
    // a fresh paragraph (`button.cpp:484-489`, from `option_button.cpp:451`) and only the draw sets a
    // width, on `text_buf` (`button.cpp:432`), so an item never wraps and the height stays one line.
    const facts = {
      ...itemFacts,
      hasText: text.length > 0 || selectedText.length > 0,
      iconNaturalSize: n.textureSlots[optionItemIconSlotKey(index)] ?? null,
    };
    const size = measuredContentMinimumSize(facts, measure(text), props);
    itemW = Math.max(itemW, size.x);
    itemH = Math.max(itemH, size.y);
  }

  const hSeparation = optionButtonHSeparation(n.constants, ctx);
  const arrow = optionButtonArrowSize(n);

  const width = marginX + itemW + arrow.x + hSeparation;
  const height = marginY + Math.max(itemH, arrow.y);

  return { x: width, y: height };
};

// Content layout: icon, text and arrow placement

interface OptionButtonContentInput {
  /** {@link optionButtonContentFacts} plus the shaped label's size and direction. */
  content: ButtonContentInput;
  arrowSize: Vector2;
  /** `arrow_margin` theme constant, measured from the full rect edge, not the content-margin edge. */
  arrowMargin: number;
}

interface OptionButtonContentLayout extends Pick<ButtonContentLayout, 'icon' | 'labelBox'> {
  /** Local to the control's top-left, Godot px. */
  arrowRect: Rect2;
}

/**
 * The arrow `ofs` (`option_button.cpp:122-131`) beside Button's layout of its icon and label in what the
 * arrow leaves (`button.cpp:247-259,333-456`). `is_layout_rtl()` picks the arrow's side. The arrow reads
 * only `arrow_margin` against the full control size.
 */
export function layoutOptionButtonContent({
  content,
  arrowSize,
  arrowMargin,
}: OptionButtonContentInput): OptionButtonContentLayout {
  const { rectSize, rtl } = content;
  const arrowRect: Rect2 = {
    x: Math.floor(rtl ? arrowMargin : rectSize.x - arrowSize.x - arrowMargin),
    y: Math.floor(Math.abs((rectSize.y - arrowSize.y) / 2)),
    w: arrowSize.x,
    h: arrowSize.y,
  };
  const { icon, labelBox } = layoutButtonContent(content);
  return { arrowRect, icon, labelBox };
}
