/**
 * `StyleBoxLine` — a resolved `StyleBoxLine` SubResource (`style_box_line.h`/
 * `.cpp`), the generic parse any `theme_override_styles/*` slot resolves to
 * when it names this kind — `Separator` is one caller (`nodes/2d/ui/
 * separator/`), not the only one: any Control's stylebox slot can name a
 * StyleBoxLine, and `native/parseStyleBox.ts` is what dispatches to this
 * parser for all of them.
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

import type { TscnInternalResource } from '../../../parser/types';
import { parseResourceReference, findSubResource } from '../../../resources/SubResourceResolver';
import { colorOr } from '../../../utils/colorParser';
import { floatOr, intOr, boolOr } from '../../../parser/valueParsers';
import type { ControlColor } from '../../../nodes/2d/ui/control/types';

export interface StyleBoxLineData {
  color: ControlColor;
  /** `style_box_line.h:36` — default `1`. */
  thickness: number;
  /** `style_box_line.h:37` — default `false`, independent of the owning widget's own orientation (a `Separator`'s, say). */
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
 * Resolve a `theme_override_styles/*` (or any StyleBox-slot) ref to a
 * `StyleBoxLineData`, or `null` for an absent/malformed ref, a non-SubResource
 * form, an unknown id, or a resource that is not a `StyleBoxLine` at all.
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
