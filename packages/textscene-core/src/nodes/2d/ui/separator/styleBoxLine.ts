/**
 * `StyleBoxLine` — a resolved `separator` StyleBox (`style_box_line.h`/`.cpp`),
 * the only StyleBox type `Separator` draws. `buildSolveTree.ts`'s
 * `resolveStyleBoxes` only resolves `StyleBoxFlat`/`StyleBoxEmpty`
 * (`native/parseStyleBox.ts`), so a `theme_override_styles/separator`
 * pointing at a `StyleBoxLine` is omitted from `solveNode.styleBoxes`
 * entirely — this slice resolves it independently, the same
 * reference-parse + `findSubResource` funnel `parseStyleBox.ts` uses.
 *
 * `margin` stores the EFFECTIVE per-side margin (`StyleBox::get_margin`,
 * `style_box.cpp:78-86`: the authored `content_margin`, or — when unset,
 * the `-1` sentinel — `get_style_margin`), not the raw `-1`, mirroring
 * `StyleBoxFlatData.contentMargin`'s own convention.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { TscnInternalResource } from '../../../../parser/types';
import { parseResourceReference, findSubResource } from '../../../../resources/SubResourceResolver';
import { colorOr } from '../../../../utils/colorParser';
import { floatOr, intOr, boolOr } from '../../../../parser/valueParsers';
import type { ControlColor } from '../control/types';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface StyleBoxLineData {
  color: ControlColor;
  /** `style_box_line.h:36` — default `1`. */
  thickness: number;
  /** `style_box_line.h:37` — default `false`, independent of the owning `Separator`'s own orientation. */
  vertical: boolean;
  /** `style_box_line.h:38` — default `1.0`. */
  growBegin: number;
  /** `style_box_line.h:39` — default `1.0`. */
  growEnd: number;
  margin: { left: number; top: number; right: number; bottom: number };
}

const CONTEXT = 'StyleBoxLine';

/** `style_box_line.h:34` — bare `Color color;`, default-constructed opaque black. */
const DEFAULT_LINE_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 1 };

/** `style_box.cpp:143`'s sentinel — "ask `get_style_margin`" (also `parseStyleBox.ts`'s `CONTENT_MARGIN_UNSET`). */
const CONTENT_MARGIN_UNSET = -1;

type Side = 'left' | 'top' | 'right' | 'bottom';

/** `StyleBoxLine::get_style_margin` (`style_box_line.cpp:33-43`): half the thickness on the axis PERPENDICULAR to `vertical`, zero on the other. */
function styleMargin(side: Side, vertical: boolean, thickness: number): number {
  const half = thickness / 2;
  if (vertical) return side === 'left' || side === 'right' ? half : 0;
  return side === 'top' || side === 'bottom' ? half : 0;
}

/** `StyleBox::get_margin` (`style_box.cpp:78-86`): the authored value, or `get_style_margin` when unset. */
function marginOr(raw: string | undefined, side: Side, vertical: boolean, thickness: number): number {
  const parsed = floatOr(raw, CONTENT_MARGIN_UNSET, CONTEXT);
  return parsed < 0 ? styleMargin(side, vertical, thickness) : parsed;
}

/**
 * Resolve a `theme_override_styles/separator` (or any StyleBox-slot) ref to a
 * `StyleBoxLineData`, or `null` for an absent/malformed ref, a non-SubResource
 * form, an unknown id, or a resource that is not a `StyleBoxLine` at all
 * (a `StyleBoxFlat`/`StyleBoxEmpty` override already resolves through
 * `solveNode.styleBoxes.separator` instead — see this module's own doc).
 */
export function parseStyleBoxLine(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): StyleBoxLineData | null {
  if (!ref) return null;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'StyleBoxLine') return null;

  const data = resource.data as Record<string, string>;
  const thickness = intOr(data.thickness, 1, CONTEXT);
  const vertical = boolOr(data.vertical, false, CONTEXT);

  return {
    color: colorOr(data.color, DEFAULT_LINE_COLOR),
    thickness,
    vertical,
    growBegin: floatOr(data.grow_begin, 1, CONTEXT),
    growEnd: floatOr(data.grow_end, 1, CONTEXT),
    margin: {
      left: marginOr(data.content_margin_left, 'left', vertical, thickness),
      top: marginOr(data.content_margin_top, 'top', vertical, thickness),
      right: marginOr(data.content_margin_right, 'right', vertical, thickness),
      bottom: marginOr(data.content_margin_bottom, 'bottom', vertical, thickness),
    },
  };
}

/** `style_separator_color` (`default_theme.cpp:124`) — `Color(0.5, 0.5, 0.5)`. */
const DEFAULT_SEPARATOR_LINE_COLOR: ControlColor = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

/**
 * `set_thickness(Math::round(scale))` (`default_theme.cpp:735`). `NativeTheme`
 * carries every OTHER default-theme metric already scaled
 * (`godotDefaultTheme.ts`'s `scaledGodotTheme`), but no raw project scale to
 * reproduce this one — pinned to Godot's `scale = 1` result. A project with a
 * non-default `gui/theme/default_theme_scale` therefore draws the default
 * separator line at 1px regardless of scale (see this slice's `comparison.md`).
 */
const DEFAULT_LINE_THICKNESS = 1;

/**
 * The default theme's `separator` StyleBoxLine for `HSeparator`/`VSeparator`
 * (`default_theme.cpp:734-740,1063-1064`) — `separator_horizontal` and its
 * `duplicate()` `separator_vertical` (`set_vertical(true)` plus transposed
 * content margins), used whenever no `theme_override_styles/separator`
 * resolves. `margin`'s along-axis pair is `default_margin`
 * (`default_theme.cpp:31`) — the SAME `Math.round(4 * scale)`
 * `ScaledGodotTheme.contentMargin` already is, not a coincidence: both read
 * the one `default_margin` local `fill_default_theme` computes once.
 */
export function defaultSeparatorStyleBoxLine(
  orientation: SeparatorOrientation,
  theme: NativeTheme
): StyleBoxLineData {
  const margin = theme.contentMargin;
  const vertical = orientation === 'vertical';
  return {
    color: DEFAULT_SEPARATOR_LINE_COLOR,
    thickness: DEFAULT_LINE_THICKNESS,
    vertical,
    growBegin: 1,
    growEnd: 1,
    margin: vertical
      ? { left: 0, top: margin, right: 0, bottom: margin }
      : { left: margin, top: 0, right: margin, bottom: 0 },
  };
}
