/**
 * LineEdit's native rect solver, `LineEdit::get_minimum_size` (`scene/gui/line_edit.cpp:2443-2477`),
 * plus the theme keys and default colours LineEdit reads. Pure per-node math: `Component.tsx` paints,
 * with the `normal` or `read_only` StyleBox this module picks by draw state from `nativeTheme.ts`'s
 * `widgets.lineEdit`, which no other widget reads.
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
 * LineEdit's own theme font key, `SceneStringName(font)` (`scene/theme/default_theme.cpp:419`). This
 * module and `Component.tsx` both pass it to `resolveNodeFontMetrics`, so they shape in the same font.
 */
export const LINE_EDIT_THEME_FONT_KEY = 'font';

/** `LineEdit::get_draw_mode`'s stylebox axis: the `theme_override_styles/*` key, and default-theme box, that the node's current `editable` selects. */
export type LineEditStyleState = 'normal' | 'read_only';

/** `editable ?? true` (Godot's `LineEdit.editable` default) as the stylebox key it selects. */
export function resolveLineEditStyleState(editable: boolean | undefined): LineEditStyleState {
  return editable === false ? 'read_only' : 'normal';
}

/** A resolved `theme_override_styles/<state>` wins, else the default-theme box for that state. */
export function pickLineEditStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  defaults: Readonly<Record<'normal' | 'readOnly', StyleBoxFlatData>>,
  state: LineEditStyleState
): StyleBoxFlatData {
  const key = state === 'read_only' ? 'readOnly' : 'normal';
  return overrides[state] ?? defaults[key];
}

/**
 * `NOTIFICATION_DRAW` (`line_edit.cpp:1430-1442`) has three text states. A field showing its
 * placeholder reads `font_placeholder_color` whatever its `editable`, so the placeholder test runs
 * first, in `_shape()`'s branch order (`displayText.ts`).
 */
export type LineEditTextState = 'normal' | 'read_only' | 'placeholder';

/** `using_placeholder` wins over `editable`: a placeholder is never editable or read-only text. */
export function resolveLineEditTextState(
  editable: boolean | undefined,
  isPlaceholder: boolean
): LineEditTextState {
  if (isPlaceholder) return 'placeholder';
  return editable === false ? 'read_only' : 'normal';
}

/** LineEdit reads one `font_size` key for every state (`default_theme.cpp:420`) but a colour key per text state (`:422,424,425`). */
const LINE_EDIT_THEME_KEYS: Record<LineEditTextState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  read_only: { sizeKey: 'font_size', colorKey: 'font_uneditable_color' },
  placeholder: { sizeKey: 'font_size', colorKey: 'font_placeholder_color' },
};

/** `control_font_color` = `Color(0.875, 0.875, 0.875)` (`default_theme.cpp:101`), LineEdit's own `font_color` default (`:422`). */
export const LINE_EDIT_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/** `control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)` (`:106`): LineEdit's `font_uneditable_color` default (`:424`). */
export const LINE_EDIT_DEFAULT_UNEDITABLE_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

/** `control_font_placeholder_color = Color(control_font_color.rgb, 0.6)` (`:107`): LineEdit's `font_placeholder_color` default (`:425`). */
export const LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.6 };

/** `control_font_color`, LineEdit's `clear_button_color` default too (`default_theme.cpp:429`). */
export const LINE_EDIT_DEFAULT_CLEAR_BUTTON_COLOR: ControlColor = LINE_EDIT_DEFAULT_FONT_COLOR;

/** `control_font_hover_color = Color(0.95, 0.95, 0.95)` (`default_theme.cpp:104`): LineEdit's `caret_color` default (`:427`). */
export const LINE_EDIT_DEFAULT_CARET_COLOR: ControlColor = { r: 0.95, g: 0.95, b: 0.95, a: 1 };

const LINE_EDIT_DEFAULT_COLORS: Record<LineEditTextState, ControlColor> = {
  normal: LINE_EDIT_DEFAULT_FONT_COLOR,
  read_only: LINE_EDIT_DEFAULT_UNEDITABLE_COLOR,
  placeholder: LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR,
};

/** This LineEdit's theme font size and colour for `state`: its overrides, else the ancestor Theme chain, else the theme default, else LineEdit's literal (`resolveTextTheme`). */
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
 * `LineEdit::_get_right_icon_size` (`line_edit.cpp:373-406`), for `right_icon` and the clear icon
 * alike. `controlSize` matters only for FIT_TO_LINE_EDIT. Null means `get_size()` still reads
 * `Size2()`, which gives `(0, 0)`, the value `get_minimum_size()` always sees. `right_icon_scale`
 * applies only in FIT_TO_LINE_EDIT (`:403`).
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
      // `get_minimum_size()` runs once, while `size_cache` is still `Size2()` (control.h:218): no
      // `update_minimum_size()` in `NOTIFICATION_RESIZED` (line_edit.cpp:1327-1330) re-runs it, and
      // nothing invalidates its cache (control.cpp:1744-1757). So this is always `(0, 0)` here, and
      // only the draw-time call from `Component.tsx` sees a real `controlSize`.
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
 * `right_icon` (`ADD_PROPERTY` line_edit.cpp:3526) in the node's own resource scope, keyed
 * `'right_icon'`, and the `clear` theme icon (`BIND_THEME_ITEM_CUSTOM` line_edit.cpp:3547), keyed
 * `'clear'` once the theme walk resolves one, as `checkbox/nativeSolver.ts`'s `checkBoxTextureSlots` does.
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
 * `LineEdit::get_minimum_size` (`line_edit.cpp:2443-2477`): `minimum_character_width` em widths of
 * 'W', widened to `full_width + caret_width` with `expand_to_text_length`, plus the widest icon, by
 * `min_size.height = MAX(shaped height, font->get_height(font_size))`, plus the larger of the `normal`
 * and `read_only` style minimum sizes.
 */
export const lineEditMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as LineEditProperties;
  const { fontSizePx } = lineEditTextTheme(n, props, 'normal', ctx);

  // `style_min_size` floors against both `normal` and `read_only`, whatever `editable` says, while the
  // draw pass reads only the active box. A wider read-only override floors an editable field too.
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
  // The height `MAX` reduces to `font->get_height`: one vendored face at one size shapes every glyph.
  // LineEdit sets no `line_spacing`, so a spacing of 0 gives ascent and descent, each ceiled, summed.
  const fontHeightPx = getFontLinePitchPx(fontMetrics, fontSizePx, 0);

  let width = LINE_EDIT_MINIMUM_CHARACTER_WIDTH * emSpaceSize;

  if (props.expandToTextLength && ctx.measureText) {
    // `full_width` (`:2456`, set at the end of `_shape()`) is the ceiled width of the string
    // `lineEditDisplayText` gives the painter, so an empty field sizes to its placeholder.
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
  // `icon_max_width` is the max of the two icons, never their sum. The clear button counts even
  // without text: `get_minimum_size` has no `using_placeholder` gate, unlike the draw path.
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

// Draw-time layout: the content rect for clipping and the text pen offset.

const HORIZONTAL_ALIGNMENT_LEFT = 0;
const HORIZONTAL_ALIGNMENT_CENTER = 1;
const HORIZONTAL_ALIGNMENT_RIGHT = 2;
const HORIZONTAL_ALIGNMENT_FILL = 3;

export interface LineEditContentInput {
  /** This Control's own solved rect size, Godot px. */
  rectSize: Vec2;
  /** The active StyleBox's content margins (`style->get_margin(SIDE_*)`), not the max of both that `lineEditMinimumSize` floors against. */
  styleMargin: { left: number; top: number; right: number; bottom: number };
  /** `HorizontalAlignment` (`alignment` property). */
  alignment: number;
  /** The shaped display text's natural unwrapped width, `0` when nothing draws. */
  textWidthPx: number;
  /** The shaped display text's own natural height. */
  textHeightPx: number;
  /** Whether `right_icon` or the clear button draws this frame (`line_edit.cpp:1444`). It gates the whole icon re-derive, which does more than subtract a zero width. Defaults `false`. */
  hasIcon?: boolean;
  /** The active icon's resolved width (`lineEditRightIconSize`), read only while `hasIcon`. Defaults `0`. */
  iconWidthPx?: number;
  /** `is_layout_rtl()` (`SolveNode.rtl`). Defaults `false`. */
  rtl?: boolean;
}

export interface LineEditContentLayout {
  /** The glyph clip rect: this rect inset by `styleMargin`, and by the active icon's width on its side, floored at a zero extent. */
  contentRect: Rect2;
  /** The text box's top-left, local Godot px, for `<TextRun>`, which anchors each line at its baseline from there (`buildGlyphQuadArrays`). */
  textOffset: Vec2;
  /** `ofs_max` (`line_edit.cpp:1420,1482`): the rightmost x a glyph pen may reach, and RIGHT alignment's caret fallback x (`lineEditCaretRect`). */
  ofsMaxPx: number;
}

/**
 * `NOTIFICATION_DRAW` (`line_edit.cpp:1392-1427`, icon inset `:1444-1485`): the `switch (alignment)`
 * for `x_ofs`, the `y_area`/`y_ofs` centring and the active icon's inset. A static preview has no
 * `scroll_offset`. Every `int(...)` truncates toward zero, so this uses `Math.trunc`: `Math.floor`
 * rounds a negative intermediate the other way.
 */
export function layoutLineEditContent(input: LineEditContentInput): LineEditContentLayout {
  const { rectSize, styleMargin, alignment, textWidthPx, textHeightPx, hasIcon = false, iconWidthPx = 0, rtl = false } = input;

  /** The LEFT/FILL and RIGHT arms, which `is_layout_rtl()` swaps (`:1397-1421`, `:1399-1403,1415-1419`). */
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

  // The icon re-derive (`:1466-1480`), ported as written: LEFT/RIGHT/FILL subtract the icon width and
  // the right margin again (`:1477`). Under RTL the icon sits at the left margin, so the text floors
  // past it (`:1473-1474`), and CENTER shifts by the icon width (`:1469-1471`).
  if (hasIcon) {
    if (alignment === HORIZONTAL_ALIGNMENT_CENTER) {
      if (rtl) xOfs += iconWidthPx;
    } else {
      xOfs = rtl
        ? Math.max(styleMargin.left + iconWidthPx, xOfs)
        : Math.max(styleMargin.left, Math.trunc(xOfs - iconWidthPx - styleMargin.right));
    }
  }

  // int y_area = height - style->get_minimum_size().height; (line_edit.cpp:1426), with the active
  // style's top and bottom margins (`style_box.cpp:35-40`), truncated toward zero on assignment.
  const yArea = Math.trunc(rectSize.y - styleMargin.top - styleMargin.bottom);
  // int y_ofs = style->get_offset().y + (y_area - text_height) / 2; (line_edit.cpp:1427). The offset's
  // Y is the active style's top margin (style_box.cpp:87-89), and the sum truncates on assignment.
  const yOfs = Math.trunc(styleMargin.top + (yArea - textHeightPx) / 2);

  // int ofs_max = width - style->get_margin(SIDE_RIGHT); ofs_max -= right_icon_size.width;
  // (line_edit.cpp:1420,1482). Both truncate, and the icon term applies only when `!rtl` (:1481-1483).
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
 * The caret block (`line_edit.cpp:1546-1585`) for a static preview: column 0, no selection, IME or
 * scroll. With real text the caret sits at the pen origin `ofs = (x_ofs, y_ofs + ascent)` (`:1608`),
 * `textPenX` for every alignment. Y comes from `fontHeightPx` in both branches: with one face,
 * `font->get_height(font_size)` (`:1553`) equals `text_height`, and an empty field has no layout.
 */
export function lineEditCaretRect(input: {
  rectSize: Vec2;
  styleMargin: { left: number; top: number; right: number; bottom: number };
  alignment: number;
  fontHeightPx: number;
  isPlaceholder: boolean;
  /** The real branch's pen-start x, `content.textOffset.x`. */
  textPenX: number;
  /** `right_icon`'s raw natural width, `0` when absent, for the fallback CENTER arm only. */
  rightIconRawWidthPx: number;
  /** `ofs_max`: the fallback RIGHT arm under LTR, and LEFT/FILL under RTL. */
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
    // `using_placeholder` means `text` is empty, whether or not a placeholder shows (`:1552-1585`).
    // LEFT/FILL and RIGHT swap under RTL (`:1560-1584`). CENTER reads `right_icon`'s raw width
    // (`right_icon->get_width()`, `:1570`), never the expand-mode size or the clear button.
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
