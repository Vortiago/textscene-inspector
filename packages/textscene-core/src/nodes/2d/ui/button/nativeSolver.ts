/**
 * The native (WebGL canvas) rect solver of Button and of every class that extends it:
 * `Button::get_minimum_size_for_text_and_icon` (`scene/gui/button.cpp:481-526`), the theme items a Button
 * reads, and what a subclass changes of both ({@link ButtonClass}). The draw-time layout lives in
 * `r3f/controls/native/buttonBase.ts`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type {
  MinimumSizeFn,
  SolveContext,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Vector2 } from '../../../../godot/math/vector';
import {
  buttonContentMinimumSize,
  buttonIconSlotRequest,
  fitIconSize,
  internalMarginAt,
  BUTTON_THEME_KEYS,
  isButtonTextClipped,
  largestStyleBoxMargins,
  largestThemedIconSize,
  pickButtonStyleBox,
  resolveToggleDrawState,
  shapeWrappedButtonLabel,
  tentativeWrapWidthPx,
  withReservedElementSize,
  type ButtonContentFacts,
  type ToggleDrawState,
} from '../../../../r3f/controls/native/buttonBase';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { sidesSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { type Rgba } from '../../../../godot/math/math';
import { HorizontalAlignment, VerticalAlignment } from '../../../../godot/math/alignment';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { ButtonProperties } from './types';
import { controlBidiOptions } from '../../../../r3f/controls/native/text/textBidiOptions';

/**
 * The theme font key of Button and of every class that extends it, `SceneStringName(font)`: each registers
 * it under its own type (`scene/theme/default_theme.cpp:152,237,261,297,337`), and the lookup starts at
 * the node's class.
 */
export const BUTTON_THEME_FONT_KEY = 'font';

/** The icon colour item of each draw state (`button.cpp:290-330`). */
const BUTTON_ICON_COLOR_KEYS: Record<ToggleDrawState, string> = {
  normal: 'icon_normal_color',
  disabled: 'icon_disabled_color',
  pressed: 'icon_pressed_color',
};

/** `font_focus_color`: the text of a focused, enabled Button (`button.cpp:284-285`). */
const BUTTON_FOCUS_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_focus_color' };

/** `icon_focus_color` (`button.cpp:286-288`). */
const BUTTON_ICON_FOCUS_COLOR_KEY = 'icon_focus_color';

/** The text and icon a Button holds and draws. */
interface ButtonShown {
  text: string;
  /** A raw Texture2D ref. */
  icon: string | undefined;
}

/**
 * What a class that extends Button changes of Button's draw and minimum size. The painter and the solver
 * read one of these, so a Button behaviour is written once for the whole family.
 */
export interface ButtonClass {
  /** The text alignment the constructor sets: CENTER for a Button (`button.h`). */
  textAlignment: number;
  /** The text and icon Button holds where they are not its `text` and `icon` properties: OptionButton's selected item. */
  shown?: (props: ButtonProperties) => ButtonShown;
  /**
   * The element the class draws over the Button: its size, and the side whose `_internal_margin`
   * reserves its width (`button.cpp:247-259`). Absent, the class reserves none.
   */
  reservedElement?: (n: ShareNode, theme: NativeTheme) => ReservedElement;
}

/** A class that draws an element over the Button. */
export type ReservingButtonClass = ButtonClass & Required<Pick<ButtonClass, 'reservedElement'>>;

/** What a Button subclass draws beside the content, such as CheckBox's check. */
export interface ReservedElement {
  side: 'left' | 'right';
  size: Vector2;
}

/** Button itself, and a subclass that changes nothing: ColorPickerButton. */
export const BUTTON_CLASS: ButtonClass = {
  textAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER,
};

/** The text and icon `props` draws as a `buttonClass`. */
export function buttonShown(buttonClass: ButtonClass, props: ButtonProperties): ButtonShown {
  return buttonClass.shown?.(props) ?? { text: props.text ?? '', icon: props.icon };
}

/**
 * The texture slots of a `buttonClass`: the icon Button shows, first because it is `SolveNode.textureSize`,
 * then the slots of the class's own element.
 */
export function buttonTextureSlotsOf(
  buttonClass: ButtonClass,
  ownSlots: TextureSlotsFn = () => []
): TextureSlotsFn {
  return (node, themedIcons = {}) => [
    buttonIconSlotRequest(buttonShown(buttonClass, node.properties as ButtonProperties).icon, themedIcons),
    ...ownSlots(node, themedIcons),
  ];
}

export const buttonTextureSlots: TextureSlotsFn = buttonTextureSlotsOf(BUTTON_CLASS);

/** Whether `props` draws with the focus colours: a focused Button in the normal draw mode (`button.cpp:282-285`). */
function isButtonFocusStyled(props: Pick<ButtonProperties, 'hasFocus'>, state: ToggleDrawState): boolean {
  return state === 'normal' && props.hasFocus === true;
}

/**
 * A Button's icon modulate in `state` (`button.cpp:280-330`). A focused Button in the normal draw mode
 * reads `icon_focus_color`, never `icon_normal_color` (`:286-288`).
 */
export function buttonIconColor(
  colors: SolveNode['colors'],
  state: ToggleDrawState,
  props: Pick<ButtonProperties, 'hasFocus'> = {}
): Rgba {
  const key = isButtonFocusStyled(props, state) ? BUTTON_ICON_FOCUS_COLOR_KEY : BUTTON_ICON_COLOR_KEYS[state];
  return requiredThemeItem(colors, key);
}

/**
 * The theme font size and colour of a Button in `state`. A focused Button in the normal draw mode reads
 * `font_focus_color` (`button.cpp:282-285`).
 */
export function buttonTextTheme(
  n: ShareNode,
  props: ButtonProperties,
  state: ToggleDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const keys = isButtonFocusStyled(props, state) ? BUTTON_FOCUS_KEYS : BUTTON_THEME_KEYS[state];
  return resolveTextTheme(n, props, keys, { fontSizePx: ctx.theme.fontSize });
}

/** `align_to_largest_stylebox` (`button.cpp:233-236`). */
function alignsToLargestStyleBox(constants: SolveNode['constants']): boolean {
  return requiredThemeItem(constants, 'align_to_largest_stylebox') !== 0;
}

/** The boxes a Button reads in one draw state. */
interface ButtonStyle {
  state: ToggleDrawState;
  /** `_get_current_stylebox` (`button.cpp:101-147`): the box the chrome draws. */
  box: StyleBoxFlatData;
  /** The margins the content lays out in: the box's own, or the largest of every state under `align_to_largest_stylebox` (`button.cpp:233-236`). */
  margin: StyleBoxFlatData['contentMargin'];
}

/** `_get_largest_stylebox_size` (`button.cpp:97-99`) by side: the padding a subclass keeps around what it reserves. */
export function buttonLargestMargin(n: ShareNode): StyleBoxFlatData['contentMargin'] {
  return largestStyleBoxMargins(n.styleBoxes, n.rtl);
}

/** `theme_cache.normal_style`, the box a subclass places its element by in every draw state (`check_box.cpp:133-135`). */
export function buttonNormalBox(n: ShareNode): StyleBoxFlatData {
  return pickButtonStyleBox(n.styleBoxes, 'normal');
}

/** `icon_max_width`, unclamped at 0 (`button.cpp:469-479`). */
function buttonIconMaxWidth(constants: SolveNode['constants']): number {
  return requiredThemeItem(constants, 'icon_max_width');
}

/**
 * The largest of the theme icons `names`, fitted to `icon_max_width`: the size a subclass reserves for all
 * its icons, and the size it draws one at (`check_box.cpp:35-62,137-142`).
 */
export function fittedThemedIconSize(
  n: Pick<SolveNode, 'textureSlots' | 'constants'>,
  names: readonly string[],
  fallback: Vector2
): Vector2 {
  const largest = largestThemedIconSize(n.textureSlots, names, fallback);
  return fitIconSize(largest, buttonIconMaxWidth(n.constants));
}

/** The boxes of `n` by its own class and `theme_type_variation`, for the draw state its properties give. */
export function buttonStyle(n: ShareNode): ButtonStyle {
  const props = n.node.properties as ButtonProperties;
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);
  const box = pickButtonStyleBox(n.styleBoxes, state, n.rtl);
  const margin = alignsToLargestStyleBox(n.constants) ? buttonLargestMargin(n) : box.contentMargin;
  return { state, box, margin };
}

/**
 * A Button's shaped label, the **solve handoff** share (`r3f/controls/native/solveHandoff.ts`) that
 * the minimum-size solver and `ButtonPainter` both call. `null` for empty text, which neither draws.
 * A plain function, not a `defineShare` memo: the memo's `(node, theme)` key cannot hold
 * `boxWidthPx`, and would answer the painter with the rows of the solver's tentative width.
 */
export function buttonLabelShape(
  n: ShareNode,
  theme: SolveContext['theme'],
  buttonClass: ButtonClass,
  boxWidthPx = 0
): TextLayoutResult | null {
  const props = n.node.properties as ButtonProperties;
  const { text } = buttonShown(buttonClass, props);
  // Resolved for empty text too: an unresolvable font then warns whatever the button shows.
  const fontMetrics = resolveNodeFontMetrics(n, BUTTON_THEME_FONT_KEY);
  if (text.length === 0) return null;
  const state = resolveToggleDrawState(props.disabled, props.buttonPressed);
  const { fontSizePx } = buttonTextTheme(n, props, state, { theme });
  // Not `ctx.measureText`: its `Vector2` drops the layout the painter needs, and its readiness
  // gate belongs to the solver. The painter shapes unconditionally.
  return shapeWrappedButtonLabel(text, props, {
    fontSizePx,
    fontMetrics,
    bidi: controlBidiOptions(props, n),
    boxWidthPx,
  });
}

/** `h_separation` of `n` (`button.cpp:394`). */
export function buttonHSeparation(n: Pick<SolveNode, 'constants'>): number {
  return requiredThemeItem(n.constants, 'h_separation');
}

/**
 * What `layoutButtonContent` reads of `n` at `rectSize`, shared by the painter and the minimum-size
 * solver. The caller adds the shaped text's size.
 */
export function buttonContentFacts(
  n: ShareNode,
  theme: NativeTheme,
  buttonClass: ButtonClass,
  rectSize: Vector2
): ButtonContentFacts {
  const props = n.node.properties as ButtonProperties;
  const reserved = buttonClass.reservedElement?.(n, theme);
  return {
    rectSize,
    styleMargin: buttonStyle(n).margin,
    hSeparation: buttonHSeparation(n),
    iconMaxWidth: buttonIconMaxWidth(n.constants),
    // Aligned against the ceiled text width (`scene/gui/button.cpp:343,349`).
    textAlignment: props.alignment ?? buttonClass.textAlignment,
    iconAlignment: props.iconAlignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
    verticalIconAlignment: props.verticalIconAlignment ?? VerticalAlignment.VERTICAL_ALIGNMENT_CENTER,
    expandIcon: props.expandIcon === true,
    // The solver's size, loaded or not, so the layout agrees with the minimum size on every frame.
    iconNaturalSize: n.textureSize,
    hasText: buttonShown(buttonClass, props).text.length > 0,
    isClipped: isButtonTextClipped(props),
    internalMargin: reserved && internalMarginAt(reserved.side, reserved.size.x),
    rtl: n.rtl,
  };
}

/**
 * `Button::get_minimum_size` for a Button of `buttonClass` (`button.cpp:481-526`), shaped by
 * {@link buttonLabelShape}. `n.rtl` reaches only the stylebox pick (`:525`, `<state>_mirrored`): the icon
 * terms test `horizontal_icon_alignment` unswapped against CENTER, so the side swap cannot move a minimum
 * size. The internal margin is not in it: a subclass adds what it reserves ({@link reservingMinimumSizeOf}).
 */
export function buttonMinimumSizeOf(buttonClass: ButtonClass): MinimumSizeFn {
  return (n, ctx) => {
    const props = n.node.properties as ButtonProperties;
    // Only `rectSize` moves with the rect, so the boxes and the reserved element resolve once.
    const facts = buttonContentFacts(n, ctx.theme, buttonClass, { x: 0, y: 0 });
    const factsAt = (rectSize: Vector2): ButtonContentFacts => ({ ...facts, rectSize });
    // Pass 2 (`tentativeRect`) knows this node's width, which a wrapping label's height depends on.
    // Pass 1 shapes unwrapped. The label wraps at what the painter's layout leaves beside the icon.
    const wrapWidthPx = tentativeWrapWidthPx(
      props,
      ctx.measureText ? ctx.tentativeRect?.(n) : undefined,
      factsAt,
      () => (ctx.measureText ? buttonLabelShape(n, ctx.theme, buttonClass) : null)
    );
    // An absent `ctx.measureText` means the text contributes nothing, while the margin and
    // the icon still count (`solverRegistry.ts`'s contract).
    const layout: TextLayoutResult | null = ctx.measureText
      ? buttonLabelShape(n, ctx.theme, buttonClass, wrapWidthPx)
      : null;
    // `minsize` starts from `paragraph->get_size()` (`button.cpp:492`), a max
    // over `TS->shaped_text_get_size(lines_rid[i])` (`text_paragraph.cpp:601-608`):
    // the ceiled extent, not the raw pen advance. Its width drops under `clip_text`, a trimming
    // overrun behaviour or autowrap, since a narrower box trims or wraps it (`button.cpp:493-495`).
    const content = buttonContentMinimumSize(facts, layout, props);
    const padding = sidesSize(facts.styleMargin);

    return { x: padding.x + content.x, y: padding.y + content.y };
  };
}

export const buttonMinimumSize: MinimumSizeFn = buttonMinimumSizeOf(BUTTON_CLASS);

/**
 * The minimum size of a `buttonClass` with its element reserved beside Button's content, as
 * `CheckBox::get_minimum_size` and `CheckButton::get_minimum_size` reserve their icon (`check_box.cpp:64-79`,
 * `check_button.cpp:68-83`). The content is what Button's minimum leaves inside the largest box of any
 * draw state (`:68-69`).
 */
export function reservingMinimumSizeOf(buttonClass: ReservingButtonClass): MinimumSizeFn {
  const buttonSize = buttonMinimumSizeOf(buttonClass);
  return (n, ctx) => {
    const element = buttonClass.reservedElement(n, ctx.theme).size;
    const padding = sidesSize(buttonLargestMargin(n));
    const minimumSize = buttonSize(n, ctx);
    const content = { x: minimumSize.x - padding.x, y: minimumSize.y - padding.y };
    const hSeparation = Math.max(0, buttonHSeparation(n));
    const reserved = withReservedElementSize(content, element, hSeparation);
    return { x: reserved.x + padding.x, y: reserved.y + padding.y };
  };
}
