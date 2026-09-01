/**
 * LineEdit's native (WebGL canvas) rect solver — `LineEdit::get_minimum_size`
 * (`scene/gui/line_edit.cpp:2443-2477`) — plus the theme-override key mapping
 * (`font_size`/`font_color`/`font_uneditable_color`/`font_placeholder_color`)
 * and the default colours LineEdit reads. Registered via
 * `controlSolverRegistry.registerMinimumSize`. Pure per-node math, no
 * THREE/React — painting is `Component.tsx`'s job, and the StyleBox
 * this module picks by draw state is `nativeTheme.ts`'s `widgets.lineEdit`
 * (a P27 addition to that shared theme, since no earlier packet needed
 * LineEdit's own `normal`/`read_only` boxes).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { getFontLinePitchPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { LINE_EDIT_MINIMUM_CHARACTER_WIDTH } from '../../../../r3f/controls/godotDefaultTheme';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
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

/**
 * `LineEdit::get_minimum_size` (`line_edit.cpp:2443-2477`), restricted to
 * what this codebase models (no `right_icon`/`clear_button`/
 * `expand_to_text_length` — none of the three are parsed onto
 * `LineEditProperties`):
 *
 *     float em_space_size = font->get_char_size('W', font_size).x;
 *     min_size.width = theme_cache.minimum_character_width * em_space_size;
 *     min_size.height = MAX(TS->shaped_text_get_size(text_rid).y, font->get_height(font_size));
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
 * The node's OWN `text`/`placeholder_text` content never appears in this
 * formula: Godot floors LineEdit's width on `minimum_character_width` (a
 * fixed 4 'W'-widths) regardless of what is actually typed, not on the
 * measured string.
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

  return {
    x: styleMinSize.x + LINE_EDIT_MINIMUM_CHARACTER_WIDTH * emSpaceSize,
    y: styleMinSize.y + fontHeightPx,
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
}

export interface LineEditContentLayout {
  /** The rect glyphs are clipped to — this Control's own rect inset by `styleMargin` on all four sides, floored at `(0, 0)` extent. */
  contentRect: Rect2;
  /** The text paragraph's own box top-left, LOCAL Godot px — feed straight to `<TextRun>`, which anchors each line at its own baseline from there (`buildGlyphQuadArrays`'s own doc). */
  textOffset: Vec2;
}

/**
 * `LineEdit::_notification`'s `NOTIFICATION_DRAW` (`line_edit.cpp:1392-1427`):
 * the horizontal `switch (alignment)` picking `x_ofs`, and the vertical
 * `y_area`/`y_ofs` centring — RTL and `scroll_offset` (always `0` in a static
 * preview with no caret/scroll state) are not modelled, matching every other
 * LineEdit feature this solver does not model.
 *
 * Every `int(...)` cast in the source TRUNCATES toward zero, not `Math.floor`
 * — `Math.trunc` is used throughout below rather than `Math.floor`, which
 * would round a negative intermediate the WRONG way (Godot's C++ semantics,
 * not JavaScript's default).
 */
export function layoutLineEditContent(input: LineEditContentInput): LineEditContentLayout {
  const { rectSize, styleMargin, alignment, textWidthPx, textHeightPx } = input;

  let xOfs: number;
  switch (alignment) {
    case HORIZONTAL_ALIGNMENT_CENTER: {
      const totalMargin = styleMargin.left + styleMargin.right;
      const diff = Math.trunc(rectSize.x - totalMargin - textWidthPx);
      const centered = Math.trunc(diff / 2);
      xOfs = styleMargin.left + Math.max(0, centered);
      break;
    }
    case HORIZONTAL_ALIGNMENT_RIGHT: {
      const candidate = Math.trunc(rectSize.x - Math.ceil(styleMargin.right + textWidthPx));
      xOfs = Math.max(styleMargin.left, candidate);
      break;
    }
    case HORIZONTAL_ALIGNMENT_LEFT:
    case HORIZONTAL_ALIGNMENT_FILL:
    default:
      xOfs = styleMargin.left;
      break;
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

  const contentRect: Rect2 = {
    x: styleMargin.left,
    y: styleMargin.top,
    w: Math.max(0, rectSize.x - styleMargin.left - styleMargin.right),
    h: Math.max(0, yArea),
  };

  return { contentRect, textOffset: { x: xOfs, y: yOfs } };
}
