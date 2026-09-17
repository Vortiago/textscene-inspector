/**
 * LineEdit's native (WebGL canvas) rect solver — `LineEdit::get_minimum_size`
 * (`scene/gui/line_edit.cpp:2443-2477`) — plus the theme-override key mapping
 * (`font_size`/`font_color`/`font_uneditable_color`/`font_placeholder_color`)
 * and the default colours LineEdit reads. Registered via
 * `controlSolverRegistry.registerMinimumSize`. Pure per-node math, no
 * THREE/React — painting is `Component.tsx`'s job, and the StyleBox
 * this module picks by draw state is `nativeTheme.ts`'s `widgets.lineEdit`
 * (LineEdit's own `normal`/`read_only` boxes, which no other widget reads).
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
import type { SolveNode, ThemedIconRef } from '../../../../r3f/controls/native/solveTree';
import { getFontLinePitchPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { shapeText, shapedTextSizeWidthPx, AutowrapMode } from '../../../../r3f/controls/native/text/textLayout';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { LINE_EDIT_MINIMUM_CHARACTER_WIDTH } from '../../../../r3f/controls/godotDefaultTheme';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { TscnNode } from '../../../../parser/types';
import type { ControlColor } from '../control/types';
import { lineEditDisplayText } from './displayText';
import { LINE_EDIT_CLEAR_ICON_NATURAL_SIZE } from './icons';
import type { LineEditProperties } from './types';

/**
 * LineEdit's own theme font key — `SceneStringName(font)` = `"font"`,
 * `scene/theme/default_theme.cpp:419`:
 * `theme->set_font(SceneStringName(font), "LineEdit", Ref<Font>());`. Fed to
 * `resolveNodeFontMetrics` by both this module and `Component.tsx` so the two
 * agree on which font this LineEdit is in.
 */
export const LINE_EDIT_THEME_FONT_KEY = 'font';

/** `LineEdit::get_draw_mode`'s stylebox axis: which `theme_override_styles/*` key (and default-theme box) this node's CURRENT `editable` selects. */
export type LineEditStyleState = 'normal' | 'read_only';

/** `editable ?? true` (Godot's own `LineEdit.editable` default), collapsed to which stylebox key it selects. */
export function resolveLineEditStyleState(editable: boolean | undefined): LineEditStyleState {
  return editable === false ? 'read_only' : 'normal';
}

/** `overrides[state]` (a resolved `theme_override_styles/<state>`) wins; otherwise the default-theme struct for that same state. */
export function pickLineEditStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  defaults: Readonly<Record<'normal' | 'readOnly', StyleBoxFlatData>>,
  state: LineEditStyleState
): StyleBoxFlatData {
  const key = state === 'read_only' ? 'readOnly' : 'normal';
  return overrides[state] ?? defaults[key];
}

/**
 * `LineEdit::_notification`'s `NOTIFICATION_DRAW` (`line_edit.cpp:1430-1442`):
 * three DISTINCT text states, not two — a field showing its placeholder reads
 * `font_placeholder_color` regardless of `editable`, so "is this the
 * placeholder" is checked BEFORE "is this editable", matching `_shape()`'s own
 * branch order (`displayText.ts`'s doc).
 */
export type LineEditTextState = 'normal' | 'read_only' | 'placeholder';

/** `using_placeholder` wins over `editable` — a placeholder never reads as "editable text" or "read-only text". */
export function resolveLineEditTextState(
  editable: boolean | undefined,
  isPlaceholder: boolean
): LineEditTextState {
  if (isPlaceholder) return 'placeholder';
  return editable === false ? 'read_only' : 'normal';
}

/** LineEdit reads a SINGLE `font_size` theme key for every state (`default_theme.cpp:420`), but a DIFFERENT colour key per text state (`:422,424,425`). */
const LINE_EDIT_THEME_KEYS: Record<LineEditTextState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  read_only: { sizeKey: 'font_size', colorKey: 'font_uneditable_color' },
  placeholder: { sizeKey: 'font_size', colorKey: 'font_placeholder_color' },
};

/** `control_font_color` = `Color(0.875, 0.875, 0.875)` (`default_theme.cpp:101`), LineEdit's own `font_color` default (`:422`). */
export const LINE_EDIT_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/** `control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)` (`:106`) — LineEdit's `font_uneditable_color` default (`:424`). */
export const LINE_EDIT_DEFAULT_UNEDITABLE_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

/** `control_font_placeholder_color = Color(control_font_color.rgb, 0.6)` (`:107`) — LineEdit's `font_placeholder_color` default (`:425`). */
export const LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.6 };

/** `control_font_color` — LineEdit's `clear_button_color` default too (`default_theme.cpp:429`), same literal as `LINE_EDIT_DEFAULT_FONT_COLOR`. */
export const LINE_EDIT_DEFAULT_CLEAR_BUTTON_COLOR: ControlColor = LINE_EDIT_DEFAULT_FONT_COLOR;

/** `control_font_hover_color = Color(0.95, 0.95, 0.95)` (`default_theme.cpp:104`) — LineEdit's `caret_color` default (`:427`). */
export const LINE_EDIT_DEFAULT_CARET_COLOR: ControlColor = { r: 0.95, g: 0.95, b: 0.95, a: 1 };

const LINE_EDIT_DEFAULT_COLORS: Record<LineEditTextState, ControlColor> = {
  normal: LINE_EDIT_DEFAULT_FONT_COLOR,
  read_only: LINE_EDIT_DEFAULT_UNEDITABLE_COLOR,
  placeholder: LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR,
};

/** Resolves this LineEdit's own theme font size/colour for `state` (overrides, else the ancestor Theme chain / theme default / LineEdit's own literal — `resolveTextTheme`'s own doc). */
export function lineEditTextTheme(
  n: SolveNode,
  props: LineEditProperties,
  state: LineEditTextState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: LINE_EDIT_DEFAULT_COLORS[state] };
  return resolveTextTheme(n, props, LINE_EDIT_THEME_KEYS[state], defaults);
}

/** `LineEdit::ExpandMode` (line_edit.cpp:3527 hint; `BIND_ENUM_CONSTANT` line_edit.cpp:3479-3481). */
export const EXPAND_MODE_ORIGINAL_SIZE = 0;
export const EXPAND_MODE_FIT_TO_TEXT = 1;
export const EXPAND_MODE_FIT_TO_LINE_EDIT = 2;

/** `caret_width` theme constant default (`default_theme.cpp:434`). */
const DEFAULT_CARET_WIDTH = 1;

/**
 * `LineEdit::_get_right_icon_size` (`line_edit.cpp:373-406`) — shared by
 * `right_icon` and the clear-button icon alike, since Godot calls it with
 * whichever texture is active. `controlSize` is this control's own resolved
 * rect size, needed only for FIT_TO_LINE_EDIT; `null` is `get_size()` still
 * reading `Size2()` (this function's own FIT_TO_LINE_EDIT branch has why),
 * which degenerates to `(0, 0)`, NOT the natural size — this is the value
 * `get_minimum_size()` always sees, never merely a first-pass placeholder.
 * `right_icon_scale` applies ONLY in the FIT_TO_LINE_EDIT branch (`:403`),
 * never to ORIGINAL_SIZE or FIT_TO_TEXT.
 */
export function lineEditRightIconSize(
  naturalSize: Vec2,
  iconExpandMode: number,
  fontHeightPx: number,
  controlSize: Vec2 | null,
  rightIconScale: number
): Vec2 {
  switch (iconExpandMode) {
    case EXPAND_MODE_FIT_TO_TEXT:
      return { x: fontHeightPx, y: fontHeightPx };
    case EXPAND_MODE_FIT_TO_LINE_EDIT: {
      // `get_size()` reads `size_cache`, still `Size2()` (control.h:218) the
      // one time `get_minimum_size()` ever runs — a resize never re-triggers
      // it (no `update_minimum_size()` in `NOTIFICATION_RESIZED`,
      // line_edit.cpp:1327-1330) or invalidates the cached result
      // (control.cpp:1744-1757). So this is not a first-pass stand-in: it is
      // always `(0, 0)` here, for every LineEdit; only the DRAW-time call
      // (`Component.tsx`, real resolved rect) ever sees a real `controlSize`.
      if (!controlSize) return { x: 0, y: 0 };
      if (naturalSize.x <= 0 || naturalSize.y <= 0) return { x: 0, y: 0 }; // never divide by a degenerate natural size.
      let iconWidth = (naturalSize.x * controlSize.y) / naturalSize.y;
      let iconHeight = controlSize.y;
      if (iconWidth > controlSize.x) {
        iconWidth = controlSize.x;
        iconHeight = (naturalSize.y * iconWidth) / naturalSize.x;
      }
      return { x: iconWidth * rightIconScale, y: iconHeight * rightIconScale };
    }
    case EXPAND_MODE_ORIGINAL_SIZE:
    default:
      return naturalSize;
  }
}

/**
 * `right_icon` (`ADD_PROPERTY` line_edit.cpp:3526) — the node's OWN resource
 * scope, keyed `'right_icon'`; and LineEdit's `clear` theme icon
 * (`BIND_THEME_ITEM_CUSTOM` line_edit.cpp:3547), keyed `'clear'` off
 * `themedIcons`, present only once the theme walk resolved one —
 * `checkbox/nativeSolver.ts`'s `checkBoxTextureSlots` is the pattern.
 */
export const lineEditTextureSlots: TextureSlotsFn = (node: TscnNode, themedIcons: Readonly<Record<string, ThemedIconRef>> = {}) => {
  const props = node.properties as LineEditProperties;
  const requests: TextureSlotRequest[] = [];
  if (props.rightIcon !== undefined) requests.push({ key: 'right_icon', ref: props.rightIcon });
  const clear = themedIcons.clear;
  if (clear) requests.push({ key: 'clear', ref: clear.ref, scope: clear.resources });
  return requests;
};

/**
 * `LineEdit::get_minimum_size` (`line_edit.cpp:2443-2477`):
 *
 *     float em_space_size = font->get_char_size('W', font_size).x;
 *     min_size.width = theme_cache.minimum_character_width * em_space_size;
 *     if (expand_to_text_length) {
 *       min_size.width = MAX(min_size.width, full_width + theme_cache.caret_width);
 *     }
 *     min_size.height = MAX(TS->shaped_text_get_size(text_rid).y, font->get_height(font_size));
 *     int icon_max_width = 0;
 *     if (right_icon.is_valid()) { ... icon_max_width = right_icon_size.width; }
 *     if (clear_button_enabled) { ... icon_max_width = MAX(icon_max_width, clear_icon_size.width); }
 *     min_size.width += icon_max_width;
 *     Size2 style_min_size = theme_cache.normal->get_minimum_size().max(theme_cache.read_only->get_minimum_size());
 *     return style_min_size + min_size;
 *
 * `style_min_size` floors against BOTH styleboxes' own minimum size —
 * `normal`'s AND `read_only`'s — regardless of this node's OWN `editable`
 * state, unlike `NOTIFICATION_DRAW`'s chrome pick (`pickLineEditStyleBox`),
 * which uses only the ACTIVE one. A read-only-only override with wider
 * margins therefore still floors an editable field's minimum size.
 *
 * `min_size.height`'s `MAX` degenerates to `font->get_height(font_size)`
 * alone in this engine: every glyph this text engine can shape comes from the
 * SAME vendored face at the SAME size, so a shaped run's own ascent/descent
 * never exceeds the font's own (no multi-face fallback is modelled, unlike
 * Godot's real TextServer). `getLinePitchPx(fontSizePx, 0)` — LineEdit sets
 * no `line_spacing` theme constant at all (unlike Label/Button), so passing
 * `0` reproduces `font->get_height` exactly: ascent and descent each
 * ceiling-rounded to a whole pixel independently, then summed, with no
 * spacing term added — the same "don't re-derive metrics" reuse
 * `label/nativeSolver.ts`'s `labelMinimumSize` already establishes.
 *
 * `full_width` (`:2456`, `full_width = TS->shaped_text_get_size(text_rid).x`,
 * set at the END of `_shape()`) is the CEILED shaped width of `_shape()`'s
 * own display string `t` — placeholder-substituted, secret-echoed and
 * `max_length`-truncated exactly like `lineEditDisplayText` already computes
 * for the painter, so this reads that SAME function rather than re-deriving
 * which string is shown. An empty field with a long placeholder therefore
 * sizes to the PLACEHOLDER.
 *
 * `icon_max_width` takes the icons' natural sizes through
 * `lineEditRightIconSize`, the MAX of `right_icon`'s and the clear button's
 * (never their sum) — `clear_button_enabled` contributes regardless of
 * whether the node has any text, unlike the DRAW path's `display_clear_icon`
 * gate (`Component.tsx`), since Godot's own `get_minimum_size` reads the
 * property directly with no `using_placeholder` check at all.
 */
export const lineEditMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as LineEditProperties;
  const { fontSizePx } = lineEditTextTheme(n, props, 'normal', ctx);

  const normalBox = pickLineEditStyleBox(n.styleBoxes, ctx.theme.widgets.lineEdit, 'normal');
  const readOnlyBox = pickLineEditStyleBox(n.styleBoxes, ctx.theme.widgets.lineEdit, 'read_only');
  const normalMargin = contentMarginSize(normalBox);
  const readOnlyMargin = contentMarginSize(readOnlyBox);
  const styleMinSize = {
    x: Math.max(normalMargin.x, readOnlyMargin.x),
    y: Math.max(normalMargin.y, readOnlyMargin.y),
  };

  const fontMetrics = resolveNodeFontMetrics(n, LINE_EDIT_THEME_FONT_KEY);
  const emSpaceSize = ctx.measureText ? ctx.measureText('W', fontSizePx, 0, fontMetrics).x : 0;
  const fontHeightPx = getFontLinePitchPx(fontMetrics, fontSizePx, 0);

  let width = LINE_EDIT_MINIMUM_CHARACTER_WIDTH * emSpaceSize;

  if (props.expandToTextLength && ctx.measureText) {
    const { text: displayed } = lineEditDisplayText(props);
    const fullWidthPx = displayed.length
      ? shapedTextSizeWidthPx(
          shapeText(displayed, {
            fontSizePx,
            boxWidthPx: 0,
            autowrapMode: AutowrapMode.OFF,
            lineSpacingPx: 0,
            fontMetrics,
            preserveControl: props.drawControlChars,
          }).widthPx
        )
      : 0;
    const caretWidthPx = n.constants['caret_width'] ?? DEFAULT_CARET_WIDTH;
    width = Math.max(width, fullWidthPx + caretWidthPx);
  }

  let height = fontHeightPx;
  let iconMaxWidth = 0;
  const tentative = ctx.tentativeRect?.(n);
  const controlSize: Vec2 | null = tentative ? { x: tentative.w, y: tentative.h } : null;
  const iconExpandMode = props.iconExpandMode ?? EXPAND_MODE_ORIGINAL_SIZE;
  const rightIconScale = props.rightIconScale ?? 1;

  const rightIconNaturalSize = n.textureSlots['right_icon'];
  if (rightIconNaturalSize) {
    const size = lineEditRightIconSize(rightIconNaturalSize, iconExpandMode, fontHeightPx, controlSize, rightIconScale);
    height = Math.max(height, size.y);
    iconMaxWidth = size.x;
  }
  if (props.clearButtonEnabled) {
    const clearNaturalSize = n.textureSlots['clear'] ?? LINE_EDIT_CLEAR_ICON_NATURAL_SIZE;
    const size = lineEditRightIconSize(clearNaturalSize, iconExpandMode, fontHeightPx, controlSize, rightIconScale);
    height = Math.max(height, size.y);
    iconMaxWidth = Math.max(iconMaxWidth, size.x);
  }
  width += iconMaxWidth;

  return {
    x: styleMinSize.x + width,
    y: styleMinSize.y + height,
  };
};

// --- Draw-time layout: content rect (for clipping) + text pen offset -------

const HORIZONTAL_ALIGNMENT_LEFT = 0;
const HORIZONTAL_ALIGNMENT_CENTER = 1;
const HORIZONTAL_ALIGNMENT_RIGHT = 2;
const HORIZONTAL_ALIGNMENT_FILL = 3;

export interface LineEditContentInput {
  /** This Control's own solved rect size, Godot px. */
  rectSize: Vec2;
  /** The ACTIVE draw-state StyleBox's content margins (`style->get_margin(SIDE_*)`) — NOT the max-of-both `lineEditMinimumSize` floors against. */
  styleMargin: { left: number; top: number; right: number; bottom: number };
  /** `HorizontalAlignment` (`alignment` property). */
  alignment: number;
  /** The shaped display text's own natural (unwrapped) width — `0` when there is nothing to draw. */
  textWidthPx: number;
  /** The shaped display text's own natural height. */
  textHeightPx: number;
  /** Whether `right_icon` or the clear button draws this frame (`line_edit.cpp:1444`) — gates the inset math below independently of `iconWidthPx`, since the block it guards does MORE than subtract a zero width (see this function's own doc). Defaults `false`. */
  hasIcon?: boolean;
  /** The active icon's own resolved (`lineEditRightIconSize`) width — meaningless while `hasIcon` is false. Defaults `0`. */
  iconWidthPx?: number;
  /** `is_layout_rtl()` (`SolveNode.rtl`). Defaults `false`. */
  rtl?: boolean;
}

export interface LineEditContentLayout {
  /** The rect glyphs are clipped to — this Control's own rect inset by `styleMargin` on all four sides (and the active icon's width, on the right), floored at `(0, 0)` extent. */
  contentRect: Rect2;
  /** The text paragraph's own box top-left, LOCAL Godot px — feed straight to `<TextRun>`, which anchors each line at its own baseline from there (`buildGlyphQuadArrays`'s own doc). */
  textOffset: Vec2;
  /** `ofs_max` (`line_edit.cpp:1420,1482`) — the rightmost x a glyph pen may reach; also RIGHT alignment's own caret-fallback x (`lineEditCaretRect`). */
  ofsMaxPx: number;
}

/**
 * `LineEdit::_notification`'s `NOTIFICATION_DRAW` (`line_edit.cpp:1392-1427`,
 * plus the icon inset at `:1444-1485`): the horizontal `switch (alignment)`
 * picking `x_ofs`, the vertical `y_area`/`y_ofs` centring, and — when
 * `hasIcon` — the inset an active `right_icon`/clear button carves out of the
 * leading edge. `scroll_offset` is always `0` in a static preview with no
 * caret/scroll state and is not modelled.
 *
 * `rtl` is the node's own `is_layout_rtl()` (`SolveNode.rtl`). It swaps the
 * LEFT/FILL and RIGHT arms (`:1397-1421`), moves the icon to the left margin
 * so the text is floored PAST it instead of pulled back from the right edge
 * (`:1473-1474`), shifts CENTER by the icon width rather than leaving it in
 * place (`:1469-1471`), and leaves `ofs_max` at the right margin, since the
 * icon is subtracted from it only when `!rtl` (`:1481-1483`).
 *
 * The icon block is NOT a plain "subtract `iconWidthPx`" — for LEFT/RIGHT/FILL
 * it re-derives `x_ofs` from the ALIGNMENT-ONLY value by subtracting BOTH the
 * icon width AND the right margin AGAIN (`:1477`, ported exactly as written,
 * not as a nicer-looking equivalent), so `hasIcon` gates the whole re-derive
 * rather than merely standing in for `iconWidthPx > 0`.
 *
 * Every `int(...)` cast in the source TRUNCATES toward zero, not `Math.floor`
 * — `Math.trunc` is used throughout below rather than `Math.floor`, which
 * would round a negative intermediate the WRONG way (Godot's C++ semantics,
 * not JavaScript's default).
 */
export function layoutLineEditContent(input: LineEditContentInput): LineEditContentLayout {
  const { rectSize, styleMargin, alignment, textWidthPx, textHeightPx, hasIcon = false, iconWidthPx = 0, rtl = false } = input;

  /** The two arms LEFT/FILL and RIGHT swap between (`:1399-1403,1415-1419`). */
  const trailingEdgeX = Math.max(styleMargin.left, Math.trunc(rectSize.x - Math.ceil(styleMargin.right + textWidthPx)));

  let xOfs: number;
  switch (alignment) {
    case HORIZONTAL_ALIGNMENT_CENTER: {
      const totalMargin = styleMargin.left + styleMargin.right;
      const iconTerm = hasIcon ? iconWidthPx : 0;
      const diff = Math.trunc(rectSize.x - totalMargin - textWidthPx - iconTerm);
      const centered = Math.trunc(diff / 2);
      xOfs = styleMargin.left + Math.max(0, centered);
      break;
    }
    case HORIZONTAL_ALIGNMENT_RIGHT:
      xOfs = rtl ? styleMargin.left : trailingEdgeX;
      break;
    case HORIZONTAL_ALIGNMENT_LEFT:
    case HORIZONTAL_ALIGNMENT_FILL:
    default:
      xOfs = rtl ? trailingEdgeX : styleMargin.left;
      break;
  }

  // The icon re-derive (`:1466-1480`). Under LTR on LEFT/FILL it clamps straight
  // back to `styleMargin.left`, which is why it used to be folded into the RIGHT
  // arm alone; under RTL that arm carries the right-aligned value and the floor
  // bites.
  if (hasIcon) {
    if (alignment === HORIZONTAL_ALIGNMENT_CENTER) {
      if (rtl) xOfs += iconWidthPx;
    } else {
      xOfs = rtl
        ? Math.max(styleMargin.left + iconWidthPx, xOfs)
        : Math.max(styleMargin.left, Math.trunc(xOfs - iconWidthPx - styleMargin.right));
    }
  }

  // int y_area = height - style->get_minimum_size().height; (line_edit.cpp:1426) — `height`
  // is already an int (`Size2 size = get_size()` truncated on assignment), and
  // `get_minimum_size().height` is the ACTIVE style's own top+bottom margins
  // (`style_box.cpp:35-40`); the whole subtraction truncates toward zero on assignment.
  const yArea = Math.trunc(rectSize.y - styleMargin.top - styleMargin.bottom);
  // int y_ofs = style->get_offset().y + (y_area - text_height) / 2; (line_edit.cpp:1427).
  // `StyleBox::get_offset()` (style_box.cpp:87-89) is `Point2(get_margin(SIDE_LEFT),
  // get_margin(SIDE_TOP))` — its Y component is the ACTIVE style's own TOP margin, which
  // was missing from this expression entirely. The whole sum truncates toward zero on
  // assignment to `int y_ofs`, same as every other `int(...)` cast in this draw path.
  const yOfs = Math.trunc(styleMargin.top + (yArea - textHeightPx) / 2);

  // int ofs_max = width - style->get_margin(SIDE_RIGHT); ofs_max -= right_icon_size.width;
  // (line_edit.cpp:1420,1482) — both truncate on assignment to `int ofs_max`, and the
  // icon term is guarded by `if (!rtl)` (:1481).
  const ofsMaxPx = Math.trunc(rectSize.x - styleMargin.right - (hasIcon && !rtl ? iconWidthPx : 0));

  // The drawn band is [x_ofs, ofs_max] (:1541); under RTL the icon sits at the LEFT
  // margin (:1455-1458), so the band starts past it instead of stopping short of it.
  const bandLeft = styleMargin.left + (hasIcon && rtl ? iconWidthPx : 0);
  const contentRect: Rect2 = {
    x: bandLeft,
    y: styleMargin.top,
    w: Math.max(0, ofsMaxPx - bandLeft),
    h: Math.max(0, yArea),
  };

  return { contentRect, textOffset: { x: xOfs, y: yOfs }, ofsMaxPx };
}

/**
 * `LineEdit::_notification`'s caret block (`line_edit.cpp:1546-1585`),
 * collapsed to what a STATIC preview (`caret_column` always `0`, no
 * selection/IME/scroll) actually draws:
 *
 * - Real text showing (`!isPlaceholder`): `shaped_text_get_carets(text_rid, 0)`
 *   sits at the shaped run's own pen origin, which `caret.l_caret.position +=
 *   ofs` (`:1608`) then places at exactly `ofs = (x_ofs, y_ofs + ascent)` —
 *   i.e. the SAME `textOffset`/height this function's own caller already
 *   computed for the text pen, for EVERY alignment (`x_ofs` is already
 *   alignment-aware by the time the caret block runs).
 * - Placeholder/empty (`isPlaceholder`, `:1552-1585` — gated on
 *   `using_placeholder`, i.e. authored `text` being empty, REGARDLESS of
 *   whether a placeholder string is actually shown): the alignment-specific
 *   fallback, whose LEFT/FILL and RIGHT arms swap under RTL (`:1560-1584`).
 *   CENTER reads `right_icon`'s own RAW, unscaled width
 *   (`right_icon->get_width()`, `:1570`) — NOT the resolved/expand-mode icon
 *   size, and NEVER the clear button. RIGHT sits at `ofs_max` exactly.
 *
 * Y is IDENTICAL in both branches in this engine: the fallback's own
 * `h = font->get_height(font_size)` (`:1553`) and the real branch's
 * `text_height` never diverge here (no multi-face fallback — same fact
 * `lineEditMinimumSize`'s own doc already relies on), so this always derives
 * Y from `fontHeightPx` directly rather than trusting a possibly-`null`
 * shaped layout for a wholly empty field.
 */
export function lineEditCaretRect(input: {
  rectSize: Vec2;
  styleMargin: { left: number; top: number; right: number; bottom: number };
  alignment: number;
  fontHeightPx: number;
  isPlaceholder: boolean;
  /** The real branch's own pen-start x — `content.textOffset.x`. */
  textPenX: number;
  /** `right_icon`'s RAW natural width, `0` when absent — the fallback CENTER arm only. */
  rightIconRawWidthPx: number;
  /** `ofs_max` — LTR's own fallback RIGHT arm, and RTL's LEFT/FILL arm. */
  ofsMaxPx: number;
  caretWidthPx: number;
  /** `is_layout_rtl()` (`SolveNode.rtl`). Defaults `false`. */
  rtl?: boolean;
}): Rect2 {
  const { rectSize, styleMargin, alignment, fontHeightPx, isPlaceholder, textPenX, rightIconRawWidthPx, ofsMaxPx, caretWidthPx, rtl = false } = input;

  const yArea = Math.trunc(rectSize.y - styleMargin.top - styleMargin.bottom);
  const y = Math.trunc(styleMargin.top + (yArea - fontHeightPx) / 2);

  let x: number;
  if (!isPlaceholder) {
    x = textPenX;
  } else {
    switch (alignment) {
      case HORIZONTAL_ALIGNMENT_CENTER: {
        const totalMargin = styleMargin.left + styleMargin.right;
        const inner = Math.trunc(rectSize.x - totalMargin - rightIconRawWidthPx);
        x = styleMargin.left + Math.max(0, Math.trunc(inner / 2));
        break;
      }
      case HORIZONTAL_ALIGNMENT_RIGHT:
        // RTL puts it at `x_ofs`, which the caller already resolved as `textPenX` (:1578-1584).
        x = rtl ? textPenX : ofsMaxPx;
        break;
      case HORIZONTAL_ALIGNMENT_LEFT:
      case HORIZONTAL_ALIGNMENT_FILL:
      default:
        x = rtl ? ofsMaxPx : styleMargin.left;
        break;
    }
  }

  return { x, y, w: caretWidthPx, h: fontHeightPx };
}
